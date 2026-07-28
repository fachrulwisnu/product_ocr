import { Router, Response } from 'express';
import multer from 'multer';
import sharp from 'sharp';
import { AuthenticatedRequest, verifyAuthToken } from '../../middleware/authMiddleware';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

const router = Router();

// Configure multer to store uploaded files in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB max file size limit
  }
});

// POST /api/v1/images/upload - Express Image Processing & Compression Pipeline
router.post(
  '/upload',
  verifyAuthToken,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No image file uploaded in field "file"'
        });
      }

      const projectId = req.body.project_id || req.body.projectId;
      if (!projectId) {
        return res.status(400).json({
          success: false,
          error: 'Field "project_id" is required'
        });
      }

      const file = req.file;
      const originalFileName = file.originalname;
      const mimeType = file.mimetype || 'image/jpeg';

      // 1. Process and compress image using Sharp
      const imagePipeline = sharp(file.buffer);
      const originalMeta = await imagePipeline.metadata();

      // Resize if width > 1920px to save storage & speed up VLM inference
      let processedPipeline = imagePipeline;
      if (originalMeta.width && originalMeta.width > 1920) {
        processedPipeline = processedPipeline.resize({
          width: 1920,
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Convert to high quality JPEG buffer (quality 85)
      const compressedBuffer = await processedPipeline
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();

      const compressedMeta = await sharp(compressedBuffer).metadata();
      const compressedWidth = compressedMeta.width || originalMeta.width || 0;
      const compressedHeight = compressedMeta.height || originalMeta.height || 0;
      const compressedSizeBytes = compressedBuffer.length;

      // Clean storage path format: ${project_id}/${Date.now()}-${filename}
      const sanitizedFileName = originalFileName.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${projectId}/${Date.now()}-${sanitizedFileName}`;

      let publicUrl = '';
      let imageId = `img-${Date.now()}`;

      // 2. Upload to Supabase Storage ('receipt-images' bucket)
      if (isSupabaseConfigured()) {
        const { error: uploadError } = await supabase.storage
          .from('receipt-images')
          .upload(storagePath, compressedBuffer, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) {
          console.warn('[Supabase Storage Warning]', uploadError.message);
        }

        const { data: urlData } = supabase.storage
          .from('receipt-images')
          .getPublicUrl(storagePath);

        publicUrl = urlData?.publicUrl || '';

        // 3. Insert record into `images_ocr` Supabase SQL Table
        const { data: dbData, error: dbError } = await supabase
          .from('images_ocr')
          .insert([
            {
              project_id: projectId,
              uploader_id: req.user?.id || null,
              original_file_name: originalFileName,
              storage_path: storagePath,
              file_size_bytes: compressedSizeBytes,
              mime_type: 'image/jpeg',
              width: compressedWidth,
              height: compressedHeight,
              status: 'COMPRESSED'
            }
          ])
          .select()
          .single();

        if (!dbError && dbData) {
          imageId = dbData.id;
        }
      }

      // Fallback base64 URL for instant display if public URL is empty
      if (!publicUrl) {
        publicUrl = `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
      }

      const responsePayload = {
        id: imageId,
        project_id: projectId,
        original_file_name: originalFileName,
        storage_path: storagePath,
        public_url: publicUrl,
        file_size_bytes: compressedSizeBytes,
        mime_type: 'image/jpeg',
        width: compressedWidth,
        height: compressedHeight,
        status: 'COMPRESSED',
        created_at: new Date().toISOString()
      };

      return res.status(201).json({
        success: true,
        message: 'Image compressed and uploaded successfully',
        data: responsePayload
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/images/project/:projectId - Fetch images for project
router.get(
  '/project/:projectId',
  verifyAuthToken,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { projectId } = req.params;

      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('images_ocr')
          .select('*')
          .eq('project_id', projectId)
          .order('created_at', { ascending: false });

        if (!error && data) {
          const formatted = data.map((item) => {
            const { data: urlData } = supabase.storage
              .from('receipt-images')
              .getPublicUrl(item.storage_path);

            return {
              ...item,
              public_url: urlData?.publicUrl || ''
            };
          });

          return res.json({
            success: true,
            count: formatted.length,
            data: formatted
          });
        }
      }

      return res.json({
        success: true,
        count: 0,
        data: []
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/v1/images/:imageId - Delete image from storage & DB
router.delete(
  '/:imageId',
  verifyAuthToken,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { imageId } = req.params;

      if (isSupabaseConfigured()) {
        // Fetch record to get storage_path
        const { data: imageRecord } = await supabase
          .from('images_ocr')
          .select('storage_path')
          .eq('id', imageId)
          .single();

        if (imageRecord?.storage_path) {
          await supabase.storage
            .from('receipt-images')
            .remove([imageRecord.storage_path]);
        }

        await supabase
          .from('images_ocr')
          .delete()
          .eq('id', imageId);
      }

      return res.json({
        success: true,
        message: `Image ${imageId} successfully deleted from storage and database.`
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
