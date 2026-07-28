import { Router, Response } from 'express';
import { AuthenticatedRequest, verifyAuthToken } from '../../middleware/authMiddleware';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

const router = Router();

// Default seed categories & templates for in-memory fallback
export interface DocumentCategory {
  id: string;
  name: string;
  description: string;
  created_at?: string;
}

export interface ReceiptTemplate {
  id: string;
  category_id: string;
  template_name: string;
  schema_rule: string;
  keywords: string[];
  created_at?: string;
}

let inMemoryCategories: DocumentCategory[] = [
  { id: 'cat-1', name: 'CIMB Niaga', description: 'CIMB Niaga ATM receipts & cassette audit forms' },
  { id: 'cat-2', name: 'Bank BCA', description: 'BCA ATM Transaction receipts' },
  { id: 'cat-3', name: 'First National Bank', description: 'FNB ATM Receipts & Cassette Reports' },
  { id: 'cat-4', name: 'Bank BRI', description: 'BRI Cash Withdrawal & Deposit receipts' }
];

let inMemoryTemplates: ReceiptTemplate[] = [
  {
    id: 'tmpl-1',
    category_id: 'cat-1',
    template_name: 'CIMB Cassette Audit',
    keywords: ['CIMB', 'CASSETTE'],
    schema_rule: 'Format as JSON with keys: BANK_NAME, ATM_ID, CASSETTE_1_DISPENSED, CASSETTE_2_DISPENSED, TOTAL_AUDIT_BALANCE, AUDIT_DATE, AUDIT_TIME, OPERATOR_ID.'
  },
  {
    id: 'tmpl-2',
    category_id: 'cat-2',
    template_name: 'BCA ATM Withdrawal',
    keywords: ['BCA', 'TARIK', 'SALDO'],
    schema_rule: 'Format as JSON with keys: BANK_NAME, ATM_LOCATION, TRANSACTION_TYPE, AMOUNT, ACCOUNT_NUMBER, REMAINING_BALANCE, TRACE_NUMBER, TRANSACTION_DATE.'
  },
  {
    id: 'tmpl-3',
    category_id: 'cat-3',
    template_name: 'FNB Standard Withdrawal',
    keywords: ['FIRST NATIONAL', 'WITHDRAWAL'],
    schema_rule: 'Format as JSON with keys: BANK_NAME, LOCATION_ID, DATE, TIME, CARD_NUMBER, TRANSACTION, AMOUNT, TERMINAL_FEE, AVAILABLE_BALANCE.'
  }
];

// Helper to get all categories
export function getActiveCategoriesStore() {
  return inMemoryCategories;
}

// Helper to get all templates
export function getActiveTemplatesStore() {
  return inMemoryTemplates;
}

// ----------------------------------------------------------------------
// CATEGORIES ROUTES
// ----------------------------------------------------------------------

// GET /api/v1/templates/categories
router.get('/categories', verifyAuthToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('document_categories_ocr').select('*').order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        return res.json({ success: true, data });
      }
    }
    return res.json({ success: true, data: inMemoryCategories });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/templates/categories
router.post('/categories', verifyAuthToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, error: 'Category name is required' });
    }

    const newCategory: DocumentCategory = {
      id: `cat-${Date.now()}`,
      name: name.trim(),
      description: description || '',
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('document_categories_ocr')
        .insert([{ name: newCategory.name, description: newCategory.description }])
        .select()
        .single();

      if (!error && data) {
        return res.status(201).json({ success: true, data });
      }
    }

    inMemoryCategories.push(newCategory);
    return res.status(201).json({ success: true, data: newCategory });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/templates/categories/:id
router.delete('/categories/:id', verifyAuthToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    if (isSupabaseConfigured()) {
      await supabase.from('document_categories_ocr').delete().eq('id', id);
    }
    inMemoryCategories = inMemoryCategories.filter(c => c.id !== id);
    inMemoryTemplates = inMemoryTemplates.filter(t => t.category_id !== id);
    return res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------------------------------------
// TEMPLATES ROUTES
// ----------------------------------------------------------------------

// GET /api/v1/templates/receipt-templates
router.get('/receipt-templates', verifyAuthToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    if (isSupabaseConfigured()) {
      const { data, error } = await supabase.from('receipt_templates_ocr').select('*').order('created_at', { ascending: true });
      if (!error && data && data.length > 0) {
        return res.json({ success: true, data });
      }
    }
    return res.json({ success: true, data: inMemoryTemplates });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/templates/receipt-templates
router.post('/receipt-templates', verifyAuthToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { category_id, template_name, schema_rule, keywords } = req.body;
    if (!template_name || !schema_rule) {
      return res.status(400).json({ success: false, error: 'template_name and schema_rule are required' });
    }

    const keywordArray = Array.isArray(keywords)
      ? keywords.map((k: string) => k.trim())
      : typeof keywords === 'string'
      ? keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
      : [];

    const newTemplate: ReceiptTemplate = {
      id: `tmpl-${Date.now()}`,
      category_id: category_id || '',
      template_name: template_name.trim(),
      schema_rule: schema_rule.trim(),
      keywords: keywordArray,
      created_at: new Date().toISOString()
    };

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('receipt_templates_ocr')
        .insert([{
          category_id: newTemplate.category_id || null,
          template_name: newTemplate.template_name,
          schema_rule: newTemplate.schema_rule,
          keywords: newTemplate.keywords
        }])
        .select()
        .single();

      if (!error && data) {
        return res.status(201).json({ success: true, data });
      }
    }

    inMemoryTemplates.push(newTemplate);
    return res.status(201).json({ success: true, data: newTemplate });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/templates/receipt-templates/:id
router.put('/receipt-templates/:id', verifyAuthToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    const { category_id, template_name, schema_rule, keywords } = req.body;

    const keywordArray = Array.isArray(keywords)
      ? keywords.map((k: string) => k.trim())
      : typeof keywords === 'string'
      ? keywords.split(',').map((k: string) => k.trim()).filter(Boolean)
      : [];

    if (isSupabaseConfigured()) {
      const { data, error } = await supabase
        .from('receipt_templates_ocr')
        .update({
          category_id: category_id || null,
          template_name,
          schema_rule,
          keywords: keywordArray
        })
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        return res.json({ success: true, data });
      }
    }

    const idx = inMemoryTemplates.findIndex(t => t.id === id);
    if (idx !== -1) {
      inMemoryTemplates[idx] = {
        ...inMemoryTemplates[idx],
        category_id: category_id || inMemoryTemplates[idx].category_id,
        template_name: template_name || inMemoryTemplates[idx].template_name,
        schema_rule: schema_rule || inMemoryTemplates[idx].schema_rule,
        keywords: keywordArray.length > 0 ? keywordArray : inMemoryTemplates[idx].keywords
      };
      return res.json({ success: true, data: inMemoryTemplates[idx] });
    }

    return res.status(404).json({ success: false, error: 'Template not found' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/templates/receipt-templates/:id
router.delete('/receipt-templates/:id', verifyAuthToken, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { id } = req.params;
    if (isSupabaseConfigured()) {
      await supabase.from('receipt_templates_ocr').delete().eq('id', id);
    }
    inMemoryTemplates = inMemoryTemplates.filter(t => t.id !== id);
    return res.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
