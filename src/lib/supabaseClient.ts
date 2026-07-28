import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read Supabase config from environment variables
const envObj = (import.meta as any)?.env || {};
const supabaseUrl = envObj.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env?.SUPABASE_URL || process.env?.VITE_SUPABASE_URL : '') || '';
const supabaseKey = envObj.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env?.SUPABASE_ANON_KEY || process.env?.VITE_SUPABASE_ANON_KEY : '') || '';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseInstance && supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseKey);
    } catch (err) {
      console.warn('Failed to initialize Supabase client:', err);
    }
  }
  return supabaseInstance;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey && supabaseUrl.startsWith('http'));
}

// ----------------------------------------------------
// Supabase Database CRUD Helpers Matching User Schema
// ----------------------------------------------------

export interface SupabaseProjectRow {
  id?: string;
  name: string;
  description?: string;
  document_type?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseImageRow {
  id?: string;
  project_id: string;
  filename?: string;
  original_filename?: string;
  storage_path?: string;
  image_width?: number;
  image_height?: number;
  file_size?: number;
  mime_type?: string;
  upload_status?: string;
  uploaded_at?: string;
}

export interface SupabaseOcrResultRow {
  id?: string;
  image_id: string;
  provider?: string;
  raw_text?: string;
  raw_json?: any;
  confidence?: number;
  processing_time_ms?: number;
  created_at?: string;
}

export interface SupabaseOcrBlockRow {
  id?: string;
  ocr_result_id: string;
  page?: number;
  text?: string;
  confidence?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  x3?: number;
  y3?: number;
  x4?: number;
  y4?: number;
}

export interface SupabaseLabelRow {
  id?: string;
  project_id: string;
  name?: string;
  color?: string;
  created_at?: string;
}

/** Fetch all projects from Supabase */
export async function fetchSupabaseProjects(): Promise<SupabaseProjectRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('projects').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching projects from Supabase:', error);
    return [];
  }
  return data || [];
}

/** Insert new project into Supabase */
export async function insertSupabaseProject(proj: SupabaseProjectRow): Promise<SupabaseProjectRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from('projects').insert([proj]).select().single();
  if (error) {
    console.error('Error inserting project into Supabase:', error);
    return null;
  }
  return data;
}

/** Fetch images for a project from Supabase */
export async function fetchSupabaseImages(projectId?: string): Promise<SupabaseImageRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  let query = sb.from('images').select('*').order('uploaded_at', { ascending: false });
  if (projectId) {
    query = query.eq('project_id', projectId);
  }
  const { data, error } = await query;
  if (error) {
    console.error('Error fetching images from Supabase:', error);
    return [];
  }
  return data || [];
}

/** Insert image record into Supabase */
export async function insertSupabaseImage(img: SupabaseImageRow): Promise<SupabaseImageRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.from('images').insert([img]).select().single();
  if (error) {
    console.error('Error inserting image into Supabase:', error);
    return null;
  }
  return data;
}

/** Save OCR Result and Spatial OCR Blocks into Supabase */
export async function saveSupabaseOcrResult(
  ocrResult: SupabaseOcrResultRow,
  blocks: Omit<SupabaseOcrBlockRow, 'ocr_result_id'>[]
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const { data: resData, error: resErr } = await sb.from('ocr_results').insert([ocrResult]).select().single();
  if (resErr || !resData) {
    console.error('Error inserting ocr_results into Supabase:', resErr);
    return false;
  }

  if (blocks && blocks.length > 0) {
    const blocksToInsert = blocks.map(b => ({
      ...b,
      ocr_result_id: resData.id
    }));
    const { error: blockErr } = await sb.from('ocr_blocks').insert(blocksToInsert);
    if (blockErr) {
      console.error('Error inserting ocr_blocks into Supabase:', blockErr);
    }
  }

  return true;
}

/** Fetch labels for a project from Supabase */
export async function fetchSupabaseLabels(projectId: string): Promise<SupabaseLabelRow[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb.from('labels').select('*').eq('project_id', projectId);
  if (error) {
    console.error('Error fetching labels from Supabase:', error);
    return [];
  }
  return data || [];
}

