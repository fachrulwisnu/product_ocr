import { Router, Response } from 'express';
import { AuthenticatedRequest, verifyAuthToken } from '../../middleware/authMiddleware';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { processNvidiaNemotronOcr, OcrDetectedBlock } from '../../lib/nvidiaNemotronOcr';
import { getActiveTemplatesStore } from './templates.route';

const router = Router();

// In-memory fallback stores for local testing when Supabase RLS or table is sync'ing
const inMemoryOcrResults = new Map<string, any>();
const inMemoryOcrBlocks = new Map<string, OcrDetectedBlock[]>();

// POST /api/v1/ocr/process/:imageId - Process OCR extraction with NVIDIA Nemotron OCR v2
router.post(
  '/process/:imageId',
  verifyAuthToken,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { imageId } = req.params;
      let storagePath = '';
      let base64Image = req.body?.imageData || '';

      // 1. Fetch image record from images_ocr table if configured
      if (isSupabaseConfigured()) {
        const { data: imageRecord, error: imgError } = await supabase
          .from('images_ocr')
          .select('*')
          .eq('id', imageId)
          .single();

        if (imageRecord) {
          storagePath = imageRecord.storage_path;
          
          // Update status to PROCESSING_OCR
          await supabase
            .from('images_ocr')
            .update({ status: 'PROCESSING_OCR' })
            .eq('id', imageId);
        }

        // If storagePath is present, download image buffer from Supabase 'receipt-images' bucket
        if (storagePath && !base64Image) {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('receipt-images')
            .download(storagePath);

          if (!downloadError && fileData) {
            const arrayBuffer = await fileData.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            base64Image = `data:image/jpeg;base64,${buffer.toString('base64')}`;
          }
        }
      }

      // If no base64 found yet, check body or default placeholder
      if (!base64Image) {
        base64Image = req.body?.base64Image || 'data:image/jpeg;base64,dummyPlaceholder';
      }

      // 2. Call NVIDIA Nemotron OCR v2 API service
      const ocrResult = await processNvidiaNemotronOcr(base64Image, `image_${imageId}.jpg`);

      // Detect template matching keywords
      let detectedTemplate = "General Receipt";
      const upperText = (ocrResult.raw_text || '').toUpperCase();
      const templates = getActiveTemplatesStore();
      for (const tmpl of templates) {
        if (tmpl.keywords && tmpl.keywords.length > 0) {
          if (tmpl.keywords.every((kw: string) => upperText.includes(kw.trim().toUpperCase()))) {
            detectedTemplate = tmpl.template_name;
            break;
          }
        }
      }

      let ocrResultId = `ocr-res-${Date.now()}`;

      // 3. Database Insertion: Store in `ocr_results_ocr` and bulk insert into `ocr_blocks_ocr`
      if (isSupabaseConfigured()) {
        const { data: dbResult, error: resultError } = await supabase
          .from('ocr_results_ocr')
          .insert([
            {
              image_id: imageId,
              raw_text: ocrResult.raw_text,
              raw_json_response: ocrResult.raw_json_response,
              processing_time_ms: ocrResult.processing_time_ms
            }
          ])
          .select()
          .single();

        if (!resultError && dbResult) {
          ocrResultId = dbResult.id;
        }

        // Bulk insert detected blocks/bounding boxes into `ocr_blocks_ocr`
        if (ocrResult.blocks && ocrResult.blocks.length > 0) {
          const blocksPayload = ocrResult.blocks.map(b => ({
            ocr_result_id: ocrResultId,
            text_content: b.text_content,
            confidence: b.confidence,
            box_x: b.box_x,
            box_y: b.box_y,
            box_width: b.box_width,
            box_height: b.box_height
          }));

          await supabase.from('ocr_blocks_ocr').insert(blocksPayload);
        }

        // Update image status to DONE
        await supabase
          .from('images_ocr')
          .update({ status: 'DONE' })
          .eq('id', imageId);
      }

      // Store in memory cache as well for immediate high-speed access
      inMemoryOcrResults.set(imageId, {
        id: ocrResultId,
        image_id: imageId,
        raw_text: ocrResult.raw_text,
        raw_json_response: ocrResult.raw_json_response,
        processing_time_ms: ocrResult.processing_time_ms,
        detected_template: detectedTemplate,
        created_at: new Date().toISOString()
      });
      inMemoryOcrBlocks.set(imageId, ocrResult.blocks);

      return res.status(200).json({
        success: true,
        message: 'NVIDIA Nemotron OCR v2 extraction completed successfully',
        data: {
          ocr_result_id: ocrResultId,
          image_id: imageId,
          raw_text: ocrResult.raw_text,
          detected_template: detectedTemplate,
          processing_time_ms: ocrResult.processing_time_ms,
          blocks_count: ocrResult.blocks.length,
          blocks: ocrResult.blocks
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/v1/ocr/result/:imageId - Fetch OCR result & bounding box blocks for frontend rendering
router.get(
  '/result/:imageId',
  verifyAuthToken,
  async (req: AuthenticatedRequest, res: Response, next) => {
    try {
      const { imageId } = req.params;

      if (isSupabaseConfigured()) {
        const { data: ocrResult, error: resultErr } = await supabase
          .from('ocr_results_ocr')
          .select('*')
          .eq('image_id', imageId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ocrResult) {
          const { data: blocks, error: blocksErr } = await supabase
            .from('ocr_blocks_ocr')
            .select('*')
            .eq('ocr_result_id', ocrResult.id);

          return res.json({
            success: true,
            data: {
              ocr_result: ocrResult,
              blocks: blocks || []
            }
          });
        }
      }

      // Check in-memory store
      if (inMemoryOcrResults.has(imageId)) {
        return res.json({
          success: true,
          data: {
            ocr_result: inMemoryOcrResults.get(imageId),
            blocks: inMemoryOcrBlocks.get(imageId) || []
          }
        });
      }

      return res.status(404).json({
        success: false,
        error: 'OCR result not found for this image. Click "Run OCR Extraction" to process.'
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
