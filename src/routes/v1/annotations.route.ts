import { Router, Response } from 'express';
import { AuthenticatedRequest, verifyAuthToken } from '../../middleware/authMiddleware';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

const router = Router();

export interface AnnotationRecord {
  id: string;
  image_id: string;
  project_id?: string;
  reviewer_id?: string;
  final_json_data: Record<string, any>;
  status: 'APPROVED' | 'REJECTED';
  review_time_ms?: number;
  created_at?: string;
}

// In-memory store for dev/offline testing
const inMemoryAnnotations = new Map<string, AnnotationRecord>();

// POST /api/v1/annotations/:imageId - Save human correction annotation
router.post('/:imageId', verifyAuthToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { imageId } = req.params;
    const { final_json_data, status = 'APPROVED', project_id, review_time_ms } = req.body;

    if (!final_json_data || typeof final_json_data !== 'object') {
      return res.status(400).json({ success: false, error: 'final_json_data object is required' });
    }

    const annotationId = `annot-${Date.now()}`;
    const annotationRecord: AnnotationRecord = {
      id: annotationId,
      image_id: imageId,
      project_id: project_id || '',
      reviewer_id: req.user?.id || 'reviewer-human',
      final_json_data,
      status: status === 'REJECTED' ? 'REJECTED' : 'APPROVED',
      review_time_ms: review_time_ms || 0,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured()) {
      // Try inserting into annotations_ocr table
      try {
        const { data, error } = await supabase
          .from('annotations_ocr')
          .insert([{
            image_id: imageId,
            project_id: project_id || null,
            reviewer_id: req.user?.id || null,
            final_json_data,
            status: annotationRecord.status,
            review_time_ms: annotationRecord.review_time_ms
          }])
          .select()
          .single();

        if (!error && data) {
          // Update image status to VERIFIED or REJECTED
          await supabase
            .from('images_ocr')
            .update({ status: annotationRecord.status === 'APPROVED' ? 'VERIFIED' : 'REJECTED' })
            .eq('id', imageId);

          return res.status(201).json({
            success: true,
            data
          });
        }
      } catch (dbErr) {
        console.warn('Supabase annotations_ocr save fallback:', dbErr);
      }
    }

    // Save in memory fallback
    inMemoryAnnotations.set(imageId, annotationRecord);

    return res.status(201).json({
      success: true,
      data: annotationRecord,
      message: `Annotation saved with status ${annotationRecord.status}`
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/annotations/:imageId - Get saved annotation for an image
router.get('/:imageId', verifyAuthToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { imageId } = req.params;

    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('annotations_ocr')
          .select('*')
          .eq('image_id', imageId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          return res.json({ success: true, data });
        }
      } catch (dbErr) {
        console.warn('Supabase fetch annotation error:', dbErr);
      }
    }

    const saved = inMemoryAnnotations.get(imageId);
    if (saved) {
      return res.json({ success: true, data: saved });
    }

    return res.status(404).json({ success: false, error: 'No annotation found for this image' });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/annotations - List all verified annotations
router.get('/', verifyAuthToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('annotations_ocr')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          return res.json({ success: true, count: data.length, data });
        }
      } catch (dbErr) {
        console.warn('Supabase list annotations error:', dbErr);
      }
    }

    const list = Array.from(inMemoryAnnotations.values());
    return res.json({ success: true, count: list.length, data: list });
  } catch (err) {
    next(err);
  }
});

export default router;
