import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read Supabase config from Vite environment variables with process.env fallbacks
const metaEnv = (import.meta as any).env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL : '') || 'https://demo-supabase-project.supabase.co';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_ANON_KEY || process.env?.SUPABASE_ANON_KEY : '') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo_key_placeholder';

if (!metaEnv.VITE_SUPABASE_URL && (!process.env || (!process.env.VITE_SUPABASE_URL && !process.env.SUPABASE_URL))) {
  console.warn("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not explicitly set in environment; using fallback Supabase configuration.");
}

// Create and export the Supabase client instance directly
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'http://placeholder-url.com', // Prevent immediate crash if env is momentarily missing during build
  supabaseAnonKey || 'placeholder-key'
);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: string): boolean {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

export function ensureValidUuid(id: string, defaultNamespace = '00000000'): string {
  if (isValidUuid(id)) {
    return id;
  }
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const hexOnly = (id || '').replace(/[^a-f0-9]/gi, '').padEnd(12, '0').slice(0, 12);
  return `${defaultNamespace}-0000-4000-8000-${hexOnly}`;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl && 
    supabaseAnonKey && 
    supabaseUrl.startsWith('http') && 
    !supabaseUrl.includes('placeholder-url.com')
  );
}

export function getSupabase(): SupabaseClient | null {
  if (isSupabaseConfigured()) {
    return supabase;
  }
  return null;
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

export interface SupabaseVlmResultRow {
  id?: string;
  image_id: string;
  provider?: string;
  raw_response_text?: string;
  extracted_json: Record<string, any>;
  processing_time_ms?: number;
  created_at?: string;
}

export interface SupabaseDynamicLabelRow {
  id?: string;
  project_id: string;
  label_key: string;
  is_validated?: boolean;
  created_at?: string;
}

export interface SupabaseFewShotRow {
  id?: string;
  project_id: string;
  document_type?: string;
  verified_json_output: Record<string, any>;
  created_at?: string;
}

/** Fetch latest verified human extractions for Few-Shot VLM Learning */
export async function fetchFewShotExamples(projectId: string, limit = 5): Promise<Record<string, any>[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const targetProjectId = ensureValidUuid(projectId, 'a0000000');

  try {
    const { data, error } = await sb
      .from('few_shot_library')
      .select('verified_json_output')
      .eq('project_id', targetProjectId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching few shot examples:', error);
      return [];
    }

    return (data || []).map(row => row.verified_json_output).filter(Boolean);
  } catch (err) {
    console.error('Exception fetching few shot examples:', err);
    return [];
  }
}

/** 
 * Save verified extraction into projects, images, vlm_results, dynamic_labels, and few_shot_library.
 * Hierarchical order prevents foreign key constraint violations.
 * Throws an explicit Error if any Supabase operation fails.
 */
export async function saveVerifiedExtraction(
  projectId: string, 
  imageId: string, 
  fileNameOrJson: string | Record<string, any>,
  verifiedJsonParam?: Record<string, any>
): Promise<boolean> {
  let fileName = 'document.png';
  let verifiedJson: Record<string, any> = {};

  if (typeof fileNameOrJson === 'string') {
    fileName = fileNameOrJson;
    verifiedJson = verifiedJsonParam || {};
  } else {
    verifiedJson = fileNameOrJson || {};
  }

  if (!projectId || !imageId) {
    throw new Error(`Invalid arguments: project_id (${projectId}) and image_id (${imageId}) must not be null or undefined.`);
  }

  // Ensure valid UUID format for PostgreSQL UUID foreign keys
  const targetProjectId = ensureValidUuid(projectId, 'a0000000');
  const targetImageId = ensureValidUuid(imageId, 'b0000000');

  const sb = getSupabase();
  if (!sb) {
    throw new Error("Supabase client is not initialized. Please verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY variables.");
  }

  // 1. Ensure Project exists (Upsert project row)
  const { error: projectError } = await sb
    .from('projects')
    .upsert([{ id: targetProjectId, name: 'Default Project', status: 'ACTIVE' }])
    .select();

  if (projectError) {
    console.error("Supabase Error [projects]:", projectError);
    throw new Error(`Project Insert Error: ${projectError.message}`);
  }

  // 2. Ensure Image exists (Upsert image row)
  const { error: imageError } = await sb
    .from('images')
    .upsert([{ 
      id: targetImageId, 
      project_id: targetProjectId, 
      filename: fileName || 'document.png', 
      upload_status: 'PROCESSED' 
    }])
    .select();

  if (imageError) {
    console.error("Supabase Error [images]:", imageError);
    throw new Error(`Image Insert Error: ${imageError.message}`);
  }

  // 3. NOW insert into vlm_results
  const { error: vlmError } = await sb
    .from('vlm_results')
    .insert([{
      image_id: targetImageId,
      provider: 'NVIDIA_NEMOTRON',
      extracted_json: verifiedJson,
      raw_response_text: JSON.stringify(verifiedJson)
    }]);

  if (vlmError) {
    console.error("Supabase Error [vlm_results]:", vlmError);
    throw new Error(`VLM Result Error: ${vlmError.message}`);
  }

  // 4. Extract keys and upsert into dynamic_labels
  const keys = Object.keys(verifiedJson);
  if (keys.length > 0) {
    const labelsPayload = keys.map(key => ({
      project_id: targetProjectId,
      label_key: key,
      is_validated: true
    }));

    const { error: labelsError } = await sb
      .from('dynamic_labels')
      .upsert(labelsPayload, { onConflict: 'project_id, label_key' });
      
    if (labelsError) {
       console.error("Supabase Error [dynamic_labels]:", labelsError);
       throw new Error(`Labels Error: ${labelsError.message}`);
    }
  }

  // 5. Save to few_shot_library for Instant Learning
  const { error: fewShotError } = await sb
    .from('few_shot_library')
    .insert([{
      project_id: targetProjectId,
      verified_json_output: verifiedJson
    }]);

  if (fewShotError) {
     console.error("Supabase Error [few_shot_library]:", fewShotError);
     throw new Error(`Few-Shot Error: ${fewShotError.message}`);
  }

  return true;
}

/** Save VLM Extraction result into Supabase vlm_results table */
export async function saveVlmExtraction(
  imageId: string,
  extractedJson: Record<string, any>,
  rawResponseText: string = '',
  processingTimeMs: number = 0,
  provider: string = 'NVIDIA_NEMOTRON'
): Promise<SupabaseVlmResultRow | null> {
  const sb = getSupabase();
  if (!sb) {
    console.warn('[Supabase] Supabase is not configured or offline. VLM extraction preserved in local state.');
    return null;
  }

  const targetImageId = ensureValidUuid(imageId, 'b0000000');

  try {
    const record: SupabaseVlmResultRow = {
      image_id: targetImageId,
      provider,
      raw_response_text: rawResponseText || JSON.stringify(extractedJson),
      extracted_json: extractedJson,
      processing_time_ms: processingTimeMs,
      created_at: new Date().toISOString()
    };

    const { data, error } = await sb.from('vlm_results').insert([record]).select().single();
    if (error) {
      console.error('Error saving VLM extraction to Supabase vlm_results:', error);
      return null;
    }
    console.log('[Supabase] Successfully persisted VLM extraction to vlm_results table:', data.id);
    return data;
  } catch (err) {
    console.error('Exception in saveVlmExtraction:', err);
    return null;
  }
}

/** Update or insert newly discovered key labels into dynamic_labels table for a project */
export async function updateDynamicLabels(
  projectId: string,
  keysArray: string[]
): Promise<SupabaseDynamicLabelRow[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const targetProjectId = ensureValidUuid(projectId, 'a0000000');

  try {
    // 1. Fetch existing dynamic labels for project
    const { data: existingLabels, error: fetchErr } = await sb
      .from('dynamic_labels')
      .select('label_key')
      .eq('project_id', targetProjectId);

    if (fetchErr) {
      console.error('Error fetching existing dynamic_labels:', fetchErr);
    }

    const existingKeysSet = new Set((existingLabels || []).map(l => l.label_key));

    // 2. Filter new unique keys
    const newKeys = keysArray.filter(k => k && !existingKeysSet.has(k));

    if (newKeys.length === 0) {
      console.log('[Supabase] All discovered keys already exist in dynamic_labels.');
      return [];
    }

    const rowsToInsert: SupabaseDynamicLabelRow[] = newKeys.map(k => ({
      project_id: targetProjectId,
      label_key: k,
      is_validated: true,
      created_at: new Date().toISOString()
    }));

    const { data: insertedData, error: insertErr } = await sb
      .from('dynamic_labels')
      .insert(rowsToInsert)
      .select();

    if (insertErr) {
      console.error('Error inserting new dynamic_labels:', insertErr);
      return [];
    }

    console.log(`[Supabase] Successfully inserted ${insertedData?.length || 0} new dynamic_labels records.`);
    return insertedData || [];
  } catch (err) {
    console.error('Exception in updateDynamicLabels:', err);
    return [];
  }
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

