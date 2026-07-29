/**
 * NVIDIA Nemotron VLM API Integration Module & Model Router
 * Enterprise Routing Logic for Nemotron OCR v2, Nemotron 3 Ultra 550B, and Vision LLMs
 */

import axios from 'axios';
import { GOLDEN_TEMPLATES, getGoldenTemplatesPrompt } from './goldenTemplates';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { DEFAULT_RECEIPT_TEMPLATES } from './defaultTemplates';

// Hardcoded NVIDIA API Key
export const HARDCODED_NVIDIA_API_KEY = "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";

// --- HELPER: OCR EXTRACTOR FOR TEXT-ONLY MODELS ---
async function extractRawTextWithOcr(fullDataUrl: string): Promise<string> {
  const ocrUrl = "https://ai.api.nvidia.com/v1/cv/nvidia/nemotron-ocr-v2";
  const ocrHeaders = {
    "Authorization": "Bearer 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",
    "Accept": "application/json",
    "Content-Type": "application/json"
  };

  const response = await axios.post(ocrUrl, { input: [{ type: "image_url", url: fullDataUrl }] }, { headers: ocrHeaders, timeout: 60000 });
  
  let extractedTextLines: string[] = [];
  if (response.data?.data && Array.isArray(response.data.data)) {
    response.data.data.forEach((page: any) => {
      page?.text_detections?.forEach((detection: any) => {
        if (detection?.text_prediction?.text) {
          extractedTextLines.push(detection.text_prediction.text.trim());
        }
      });
    });
  }
  return extractedTextLines.join('\n');
}

// Helper function to fetch instant learning examples from Dataset Manager (Supabase)
async function getFewShotExamples(documentCategory: string): Promise<string> {
  try {
    let query = supabase
      .from('few_shot_library')
      .select('verified_json_output, document_type')
      .order('created_at', { ascending: false })
      .limit(3);

    if (documentCategory && documentCategory !== 'AUTO_DETECT' && documentCategory !== 'AUTO') {
      query = query.eq('document_type', documentCategory);
    }

    const { data, error } = await query;

    let records: any[] | null = data;
    if ((error || !records || records.length === 0) && documentCategory && documentCategory !== 'AUTO_DETECT') {
      const fallback = await supabase
        .from('few_shot_library')
        .select('verified_json_output')
        .order('created_at', { ascending: false })
        .limit(3);
      if (!fallback.error && fallback.data) {
        records = fallback.data;
      }
    }

    if (!records || records.length === 0) {
      return '';
    }

    const examplesText = records
      .map((item: any, idx: number) => {
        const jsonContent = item.verified_json_output || item.extracted_data || item;
        return `Example ${idx + 1}: ${JSON.stringify(jsonContent)}`;
      })
      .join('\n');

    return `\nVERIFIED LEARNING EXAMPLES FROM DATASET MANAGER:\n${examplesText}\n`;
  } catch (err) {
    console.error("Failed to fetch instant learning dataset:", err);
    return '';
  }
}

/**
 * Enterprise AI Model Router for NVIDIA Models
 */
export async function extractReceiptData(
  base64Image: string,
  documentCategory?: string,
  modelId: string = 'nvidia/nemotron-ocr-v2',
  fewShotExamples: Record<string, any>[] = []
): Promise<any> {
  const base64DataOnly = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;
  const fullDataUrl = `data:image/jpeg;base64,${base64DataOnly}`;
  
  const resolvedCategory = !documentCategory || documentCategory === 'AUTO' || documentCategory === '' ? 'AUTO_DETECT' : documentCategory;
  let schemaRule = GOLDEN_TEMPLATES[resolvedCategory] || getGoldenTemplatesPrompt(resolvedCategory) || "Format as a clean JSON object.";
  const systemPrompt = `You are an expert document data extraction engine. STRICT SCHEMA RULE: ${schemaRule}. Return ONLY raw JSON without markdown formatting.`;

  // ====================================================================================
  // ROUTE A: NEMOTRON OCR v2 + HYBRID JSON FORMATTER
  // ====================================================================================
  if (modelId.includes('nemotron-ocr-v2') || modelId.includes('nemotron-nano-ocr-v2')) {
    // 1. Extract raw text from the image
    const rawTextContext = await extractRawTextWithOcr(fullDataUrl);

    // 2. Format the raw text into structured JSON using a fast LLM (Llama 3.1 70B)
    const chatUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
    const chatHeaders = {
      "Authorization": "Bearer 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", // Using Chat API Key
      "Accept": "application/json",
      "Content-Type": "application/json"
    };

    const payload = {
      model: "meta/llama-3.1-70b-instruct",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Format the following raw OCR text into a strict JSON object based on the schema rule. Do not invent data.\n\nRAW OCR TEXT:\n${rawTextContext}` }
      ],
      temperature: 0.1,
      max_tokens: 2048,
      stream: false
    };

    try {
      const response = await axios.post(chatUrl, payload, { headers: chatHeaders, timeout: 60000 });
      const structuredText = response.data.choices[0]?.message?.content || "{}";
      const parsedData = JSON.parse(structuredText.replace(/```json/g, '').replace(/```/g, '').trim());
      
      // INJECT RAW TEXT FOR THE FRONTEND DASHBOARD
      parsedData._raw_text = rawTextContext;
      
      return parsedData;
    } catch (error: any) {
      console.error("Hybrid Formatter Error:", error.response?.data || error.message);
      // Fallback: return as JSON if LLM formatting fails, so frontend doesn't use mock data
      return { raw_text_fallback: rawTextContext, _raw_text: rawTextContext }; 
    }
  }

  // ====================================================================================
  // ROUTE B: TEXT-ONLY REASONING MODELS (Ultra 550B, Llama 3.1 70B, etc.)
  // ====================================================================================
  else if ((modelId.includes('ultra') || !modelId.includes('vision')) && !modelId.toLowerCase().includes('gemini')) {
    // 1. Because these models crash with images, we MUST run OCR first.
    const rawTextContext = await extractRawTextWithOcr(fullDataUrl);

    // 2. Send ONLY TEXT to the Reasoning Model
    const chatUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
    const chatHeaders = {
      "Authorization": "Bearer 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",
      "Accept": "application/json",
      "Content-Type": "application/json"
    };

    const payload = {
      model: modelId,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract transaction details from this raw OCR text:\n\n${rawTextContext}` } // NO IMAGE URL!
      ],
      temperature: 0.1,
      top_p: 0.95,
      max_tokens: 2048,
      stream: false
    };

    try {
      const response = await axios.post(chatUrl, payload, { headers: chatHeaders, timeout: 90000 });
      const extractedText = response.data.choices[0]?.message?.content || "{}";
      const parsedData = JSON.parse(extractedText.replace(/```json/g, '').replace(/```/g, '').trim());
      
      // INJECT RAW TEXT FOR THE FRONTEND DASHBOARD
      parsedData._raw_text = rawTextContext;

      return parsedData;
    } catch (error: any) {
      throw new Error(`Reasoning Engine Error: ${JSON.stringify(error.response?.data) || error.message}`);
    }
  }

  // ====================================================================================
  // ROUTE C: VISION LLMs (Llama 3.2 90B Vision)
  // ====================================================================================
  else if (!modelId.toLowerCase().includes('gemini')) {
    const chatUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
    const chatHeaders = {
      "Authorization": "Bearer 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",
      "Accept": "application/json",
      "Content-Type": "application/json"
    };

    const payload = {
      model: modelId,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: systemPrompt },
            { type: "image_url", image_url: { url: fullDataUrl } }
          ]
        }
      ],
      max_tokens: 1024, // Reduced to prevent 502 Bad Gateway
      stream: false,    // Forced false for stability
      temperature: 0.1,
      top_p: 1
    };

    try {
      const response = await axios.post(chatUrl, payload, { headers: chatHeaders, timeout: 90000 });
      const extractedText = response.data.choices[0]?.message?.content || "{}";
      const parsedData = JSON.parse(extractedText.replace(/```json/g, '').replace(/```/g, '').trim());

      // INJECT A FALLBACK MESSAGE FOR VISION LLM
      parsedData._raw_text = "NVIDIA Vision LLM Engine used. Raw line-by-line OCR is bypassed. Please see the Field Studio tab for extracted JSON data.";

      return parsedData;
    } catch (error: any) {
      throw new Error(`Vision LLM Error: ${JSON.stringify(error.response?.data) || error.message}`);
    }
  }

  // ====================================================================================
  // ROUTE D: GOOGLE GEMINI MODELS (Gemini 3.1 Pro / 3.6 Flash via Axios)
  // ====================================================================================
  else if (modelId.toLowerCase().includes('gemini')) {
    // 1. Strictly load the key from the environment variable (.env)
    const geminiApiKey = process.env.GEMINI_API_KEY; 

    if (!geminiApiKey) {
      throw new Error("GEMINI_API_KEY is missing! Please ensure it is set in the backend .env file and the server has been restarted.");
    }

    // 2. Sanitize modelId (Remove 'google/' prefixes)
    let cleanModelId = modelId.split('/').pop() || modelId;

    // 3. Auto-upgrade to the latest 3.x models based on the model family
    if (cleanModelId.includes('pro')) {
      cleanModelId = 'gemini-3.1-pro-preview';
    } else if (cleanModelId.includes('flash')) {
      cleanModelId = 'gemini-3.6-flash';
    } else {
      // Fallback if neither 'pro' nor 'flash' is specified
      cleanModelId = 'gemini-3.6-flash'; 
    }

    // 4. Construct the clean URL for Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModelId}:generateContent`;

    // 5. Payload structure matching Google's multimodal requirements
    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: systemPrompt },
            { 
              inline_data: { 
                mime_type: "image/jpeg", 
                data: base64DataOnly 
              } 
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json"
      }
    };

    try {
      // 6. Pass the API Key securely via the x-goog-api-key header
      const response = await axios.post(geminiUrl, payload, { 
        headers: { 
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey 
        }, 
        timeout: 90000 
      });
      
      const extractedText = response.data.candidates[0]?.content?.parts[0]?.text || "{}";
      const parsedData = JSON.parse(extractedText);

      // INJECT A FALLBACK MESSAGE FOR GEMINI
      parsedData._raw_text = "Gemini Native Vision Engine used. Raw line-by-line OCR is bypassed. Please see the Field Studio tab for the extracted JSON data.";

      return parsedData;
    } catch (error: any) {
      console.error(`Gemini API Error (${cleanModelId}):`, error.response?.data || error.message);
      throw new Error(`Google Gemini Error: ${JSON.stringify(error.response?.data?.error?.message) || error.message}`);
    }
  }
}

export async function extractFullReceipt(
  base64Image: string, 
  fewShotExamples: Record<string, any>[] = [],
  documentType: string = "ATM Cash Withdrawal",
  modelId: string = "meta/llama-3.2-90b-vision-instruct"
): Promise<Record<string, any>> {
  return extractReceiptData(base64Image, documentType, modelId, fewShotExamples);
}

/**
 * Extract text/number from a user-dragged crop region of an image
 */
export async function extractCroppedRegion(croppedBase64: string): Promise<string> {
  const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
  const headers = {
    "Authorization": "Bearer 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",
    "Accept": "application/json",
    "Content-Type": "application/json"
  };

  let formattedImageUrl = croppedBase64;
  if (!croppedBase64.startsWith('data:')) {
    formattedImageUrl = `data:image/png;base64,${croppedBase64}`;
  }

  const payload = {
    "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    "max_tokens": 2048,
    "reasoning_budget": 512,
    "stream": false,
    "temperature": 0.2,
    "top_p": 0.95,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "Read and extract the text or number visible in this specific image crop. Return ONLY the raw string value, nothing else."
          },
          {
            "type": "image_url",
            "image_url": {
              "url": formattedImageUrl
            }
          }
        ]
      }
    ]
  };

  try {
    const response = await axios.post(invokeUrl, payload, { headers, timeout: 25000 });
    const content = response.data?.choices?.[0]?.message?.content || "";
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json|text)?/i, '').replace(/```$/, '').trim();
    }
    return cleaned;
  } catch (error) {
    console.error("VLM Cropped Region Extraction Error:", error);
    return "";
  }
}

export interface VlmExtractionResponse {
  rawText: string;
  extractedJson: Record<string, any>;
  documentCategory: string;
  processingTimeMs: number;
  provider: string;
}

/**
 * Invoke NVIDIA VLM to extract dynamic key-value pairs from any document image.
 */
export async function invokeNvidiaVlm(
  imageDataUri: string, 
  documentType: string = "ATM Cash Withdrawal",
  fewShotExamples: Record<string, any>[] = [],
  modelId: string = "meta/llama-3.2-90b-vision-instruct"
): Promise<VlmExtractionResponse> {
  const startTime = Date.now();
  try {
    const rawRes = await extractReceiptData(imageDataUri, documentType, modelId, fewShotExamples);

    let documentCategory: string = rawRes?.document_category || "";
    let extractedJson: Record<string, any> = (rawRes?.extracted_data && typeof rawRes.extracted_data === 'object')
      ? rawRes.extracted_data
      : rawRes;

    if (extractedJson && extractedJson.document_category) {
      delete extractedJson.document_category;
    }

    if (!documentCategory || documentCategory === "Unknown") {
      const fullTextStr = JSON.stringify(rawRes || {}).toLowerCase();
      if (fullTextStr.includes('cassette') || fullTextStr.includes('dispensed') || fullTextStr.includes('audit')) {
        documentCategory = "Cassette Audit & Cleared";
      } else if (fullTextStr.includes('nik') || fullTextStr.includes('provinsi') || fullTextStr.includes('agama') || fullTextStr.includes('ktp') || fullTextStr.includes('kewarganegaraan')) {
        documentCategory = "KTP (Indonesian ID)";
      } else if (fullTextStr.includes('atm') || fullTextStr.includes('tarik') || fullTextStr.includes('saldo') || fullTextStr.includes('withdrawal') || fullTextStr.includes('bank')) {
        documentCategory = "ATM Receipt";
      } else if (fullTextStr.includes('invoice') || fullTextStr.includes('faktur') || fullTextStr.includes('bill to') || fullTextStr.includes('subtotal')) {
        documentCategory = "Invoice";
      } else if (fullTextStr.includes('npwp') || fullTextStr.includes('pajak')) {
        documentCategory = "Tax Document (NPWP)";
      } else {
        documentCategory = documentType || "General Document";
      }
    }

    return {
      rawText: JSON.stringify(extractedJson, null, 2),
      extractedJson,
      documentCategory,
      processingTimeMs: Date.now() - startTime,
      provider: 'NVIDIA_NEMOTRON'
    };
  } catch (error: any) {
    console.error('[NVIDIA VLM] Failed or timed out:', error?.message);
    throw error;
  }
}

/**
 * Default fallback extraction for ATM Receipts when API is offline or in trial mode
 */
export function generateFallbackVlmExtraction(): Record<string, any> {
  return {};
}

/**
 * Recursive flattener function to convert nested JSON objects into dot-notation keys
 */
export function flattenJsonObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  const flattened: Record<string, any> = {};
  if (!obj || typeof obj !== 'object') return flattened;

  for (const [key, val] of Object.entries(obj)) {
    if (key === 'document_category') continue;

    const formattedKey = key.toUpperCase().replace(/\s+/g, '_');
    const fullKey = prefix ? `${prefix}.${formattedKey}` : formattedKey;

    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(flattened, flattenJsonObject(val, fullKey));
    } else if (Array.isArray(val)) {
      val.forEach((item, idx) => {
        if (item !== null && typeof item === 'object') {
          Object.assign(flattened, flattenJsonObject(item, `${fullKey}_${idx + 1}`));
        } else {
          flattened[`${fullKey}_${idx + 1}`] = item;
        }
      });
    } else {
      flattened[fullKey] = val;
    }
  }

  return flattened;
}

/**
 * Convert dynamic JSON extracted by VLM into UI ExtractedField list
 */
export function convertVlmJsonToFields(jsonObj: Record<string, any>): any[] {
  const data = (jsonObj.extracted_data && typeof jsonObj.extracted_data === 'object')
    ? jsonObj.extracted_data
    : jsonObj;

  const flattenedData = flattenJsonObject(data);

  return Object.entries(flattenedData).map(([key, val], idx) => ({
    id: `field-vlm-${idx}-${Date.now()}`,
    key: key,
    label: key.replace(/_/g, ' '),
    value: String(val ?? ''),
    confidence: 0.95,
    status: 'predicted',
    category: key.includes('.') ? 'nested_tabular' : 'vlm_discovered'
  }));
}
