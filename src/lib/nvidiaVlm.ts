/**
 * NVIDIA Nemotron VLM API Integration Module & Model Router
 * Enterprise Routing Logic for Nemotron OCR v2, Nemotron 3 Ultra 550B, and Vision LLMs
 */

import axios from 'axios';
import OpenAI from 'openai';
import { GOLDEN_TEMPLATES } from './goldenTemplates';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { DEFAULT_RECEIPT_TEMPLATES } from './defaultTemplates';

// Hardcoded NVIDIA API Key
export const HARDCODED_NVIDIA_API_KEY = "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";

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
  // 1. Sanitize Base64 String
  const base64DataOnly = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;
  const fullDataUrl = `data:image/jpeg;base64,${base64DataOnly}`;
  
  // 2. Resolve Category & Schema
  const resolvedCategory = !documentCategory || documentCategory === 'AUTO' || documentCategory === '' ? 'AUTO_DETECT' : documentCategory;
  const schemaRule = GOLDEN_TEMPLATES[resolvedCategory] || 
    "Format as JSON. First, automatically detect the document issuer or bank name. Then, extract all relevant fields, line items, totals, and metadata into a clean JSON structure.";

  const systemPrompt = `You are an expert document and financial data extraction engine. Extract transaction details into a clean JSON object. Return ONLY raw JSON without markdown. STRICT SCHEMA RULE: ${schemaRule}`;

  const modelIdLower = modelId.toLowerCase();

  // ====================================================================================
  // ROUTE A: COMPUTER VISION ENDPOINT (NVIDIA NEMOTRON OCR v2) + HYBRID FORMATTER
  // ====================================================================================
  if (modelId.includes('nemotron-ocr-v2') || modelId.includes('nemotron-nano-ocr-v2') || modelIdLower.includes('ocr')) {
    const ocrUrl = "https://ai.api.nvidia.com/v1/cv/nvidia/nemotron-ocr-v2";
    const ocrHeaders = {
      "Authorization": "Bearer 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",
      "Accept": "application/json",
      "Content-Type": "application/json"
    };

    const payload = { input: [ { type: "image_url", url: fullDataUrl } ] };

    try {
      // 1. Call Nemotron OCR for raw text detection
      const response = await axios.post(ocrUrl, payload, { headers: ocrHeaders, timeout: 90000 });
      const rawData = response.data;
      
      // 2. Parse the deeply nested NVIDIA response into an array of clean text lines
      const extractedTextLines: string[] = [];
      const cleanedData: Record<string, string> = {}; // Fallback object

      if (rawData?.data && Array.isArray(rawData.data)) {
        rawData.data.forEach((page: any) => {
          if (page?.text_detections && Array.isArray(page.text_detections)) {
            page.text_detections.forEach((detection: any, index: number) => {
              const textValue = detection?.text_prediction?.text;
              if (textValue) {
                cleanedData[`LINE_${index + 1}`] = textValue.trim();
                extractedTextLines.push(textValue.trim());
              }
            });
          }
        });
      }

      if (extractedTextLines.length === 0 && rawData?.text_detections && Array.isArray(rawData.text_detections)) {
        rawData.text_detections.forEach((detection: any, index: number) => {
          const textValue = detection?.text || detection?.label || detection?.text_prediction?.text;
          if (textValue) {
            cleanedData[`LINE_${index + 1}`] = textValue.trim();
            extractedTextLines.push(textValue.trim());
          }
        });
      }

      // 3. Document Classification & Template Matching
      const combinedRawText = extractedTextLines.join(' ').toUpperCase();
      let dbTemplates: any[] = [];

      if (isSupabaseConfigured()) {
        try {
          const { data } = await supabase.from('receipt_templates_ocr').select('*');
          if (data && data.length > 0) {
            dbTemplates = data;
          }
        } catch (err) {
          console.warn("Supabase receipt_templates_ocr fetch error:", err);
        }
      }

      if (dbTemplates.length === 0) {
        dbTemplates = DEFAULT_RECEIPT_TEMPLATES;
      }

      let activeSchemaRule = schemaRule || "Format as a general receipt JSON.";
      let detectedTemplate = "General Receipt";

      for (const tmpl of dbTemplates) {
        if (tmpl.keywords && Array.isArray(tmpl.keywords) && tmpl.keywords.length > 0) {
          const match = tmpl.keywords.every((kw: string) => combinedRawText.includes(kw.trim().toUpperCase()));
          if (match) {
            activeSchemaRule = tmpl.schema_rule;
            detectedTemplate = tmpl.template_name;
            break;
          }
        }
      }

      // 4. Hybrid Formatting: Send the clean lines to Llama 3.1 70B for JSON structuring
      if (extractedTextLines.length > 0) {
        const chatUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
        const chatHeaders = {
          "Authorization": "Bearer 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",
          "Accept": "application/json",
          "Content-Type": "application/json"
        };

        const formattingPrompt = `You are an expert OCR data formatter. Format the following raw OCR text lines into a clean JSON object. STRICT SCHEMA RULE: ${activeSchemaRule}. Return ONLY raw JSON without markdown formatting. Include a key "auto_detected_template": "${detectedTemplate}".`;

        const formatPayload = {
          model: "meta/llama-3.1-70b-instruct",
          messages: [
            { role: "system", content: formattingPrompt },
            { role: "user", content: extractedTextLines.join('\n') }
          ],
          temperature: 0.1,
          max_tokens: 2048
        };

        try {
          const formatResponse = await axios.post(chatUrl, formatPayload, { headers: chatHeaders, timeout: 30000 });
          const structuredText = formatResponse.data.choices[0].message.content;
          const parsed = JSON.parse(structuredText.replace(/```json/g, '').replace(/```/g, '').trim());
          if (typeof parsed === 'object' && parsed !== null) {
            parsed.auto_detected_template = detectedTemplate;
          }
          return parsed;
        } catch (formatErr) {
          console.warn("Llama 3.1 70B formatting fallback:", formatErr);
          cleanedData.auto_detected_template = detectedTemplate;
          return cleanedData;
        }
      }

      // 5. Fallback if formatting fails or schema is missing: return clean lines
      cleanedData.auto_detected_template = detectedTemplate;
      return cleanedData; 

    } catch (error: any) {
      console.error("Nemotron OCR v2 Error:", error.response?.data || error.message);
      throw new Error(`OCR Engine Error: ${error.response?.data?.detail || error.message}`);
    }
  }

  // ====================================================================================
  // ROUTE B: ADVANCED REASONING MODEL (NEMOTRON 3 ULTRA 550B via OPENAI SDK)
  // ====================================================================================
  else if (modelId === 'nvidia/nemotron-3-ultra-550b-a55b') {
    const client = new OpenAI({
      apiKey: "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",
      baseURL: "https://integrate.api.nvidia.com/v1",
      dangerouslyAllowBrowser: true 
    });

    try {
      const completion: any = await client.chat.completions.create({
        model: "nvidia/nemotron-3-ultra-550b-a55b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Extract structured data from this document/invoice." }
        ],
        temperature: 1,
        top_p: 0.95,
        max_tokens: 16384,
        // @ts-ignore
        extra_body: {
          chat_template_kwargs: { enable_thinking: true },
          reasoning_budget: 16384
        }
      });

      const extractedText = completion.choices[0]?.message?.content || "{}";
      return JSON.parse(extractedText.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (error: any) {
      console.error("Nemotron 3 Ultra Reasoning Error:", error);
      throw error;
    }
  }

  // ====================================================================================
  // ROUTE C: STANDARD VISION LLMs (LLAMA 3.2 90B VISION, NEMOTRON NANO VL, etc.)
  // ====================================================================================
  else {
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
      max_tokens: 4096,
      temperature: 0.1,
      top_p: 1
    };

    try {
      const response = await axios.post(chatUrl, payload, { headers: chatHeaders, timeout: 90000 });
      const extractedText = response.data.choices[0].message.content;
      return JSON.parse(extractedText.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (error: any) {
      console.error(`Chat Completions API Error (${modelId}):`, error.response?.data || error.message);
      throw new Error(`Vision LLM Error: ${error.response?.data?.detail || error.message}`);
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
  return {
    "ATM_LOCATION": "FIRST NATIONAL BANK - DOWNTOWN BRANCH #4829",
    "TERMINAL_ID": "ATM-8842-NY",
    "TRANSACTION_DATE": "2026-07-27",
    "TRANSACTION_TIME": "14:32:08",
    "RECORD_NUMBER": "0094182",
    "CARD_NUMBER": "************4819",
    "TRANSACTION_TYPE": "CASH WITHDRAWAL",
    "ACCOUNT_TYPE": "CHECKING ***8821",
    "WITHDRAWAL_AMOUNT": "$200.00",
    "SURCHARGE_FEE": "$2.50",
    "TOTAL_DEBIT": "$202.50",
    "AVAILABLE_BALANCE": "$1,482.10",
    "CASSETTE_1_DISPENSED": "10",
    "CASSETTE_2_DISPENSED": "0",
    "AUTHORIZATION_CODE": "981240"
  };
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
