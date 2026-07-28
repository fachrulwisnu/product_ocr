import { Router, Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest, verifyAuthToken } from '../../middleware/authMiddleware';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

const router = Router();

// Zod Schema for Project Creation
const createProjectSchema = z.object({
  name: z.string().min(2, 'Project name must be at least 2 characters'),
  description: z.string().optional(),
  receiptType: z.string().optional()
});

// GET /api/v1/projects - List all projects from projects_ocr table
router.get('/', verifyAuthToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('projects_ocr')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        return res.json({
          success: true,
          count: data.length,
          data
        });
      }
    }

    // Return empty list or fallback response if table not yet populated
    return res.json({
      success: true,
      count: 0,
      data: []
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/projects - Create new project in projects_ocr table
router.post('/', verifyAuthToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const validated = createProjectSchema.parse(req.body);

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('projects_ocr')
        .insert([
          {
            name: validated.name,
            description: validated.description || 'ATM receipt document AI extraction project'
          }
        ])
        .select()
        .single();

      if (error) {
        throw new Error(`Supabase projects_ocr insert error: ${error.message}`);
      }

      return res.status(201).json({
        success: true,
        data
      });
    }

    // Fallback created object for offline / dev mode
    const fallbackProject = {
      id: `proj-${Date.now()}`,
      name: validated.name,
      description: validated.description || 'ATM receipt document AI extraction project',
      created_at: new Date().toISOString()
    };

    return res.status(201).json({
      success: true,
      data: fallbackProject
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/projects/:id - Get single project by ID
router.get('/:id', verifyAuthToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('projects_ocr')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        return res.status(404).json({
          success: false,
          error: 'Project not found'
        });
      }

      return res.json({
        success: true,
        data
      });
    }

    return res.status(404).json({
      success: false,
      error: 'Project not found'
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/projects/:id - Delete project by ID
router.delete('/:id', verifyAuthToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured()) {
      const { error } = await supabase
        .from('projects_ocr')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Delete failed: ${error.message}`);
      }
    }

    return res.json({
      success: true,
      message: `Project ${id} successfully deleted`
    });
  } catch (err) {
    next(err);
  }
});

export default router;
