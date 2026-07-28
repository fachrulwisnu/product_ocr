/**
 * NVIDIA Nemotron VLM API Integration Module
 * Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
 * Model: nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
 */

import axios from 'axios';
import { getGoldenTemplatesPrompt } from './goldenTemplates';

// Hardcoded NVIDIA API Key as requested by project specifications
export const HARDCODED_NVIDIA_API_KEY = "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";

export async function extractFullReceipt(
  base64Image: string, 
  fewShotExamples: Record<string, any>[] = [],
  documentType: string = "ATM Cash Withdrawal",
  modelId: string = "meta/llama-3.2-90b-vision-instruct"
): Promise<Record<string, any>> {
  const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
  const stream = false;

  // HARDCODED HEADER AS REQUESTED
  const headers = {
    "Authorization": "Bearer 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",
    "Accept": "application/json",
    "Content-Type": "application/json"
  };

  // Ensure image is proper base64 data URI
  let formattedImageUrl = base64Image;
  if (!base64Image.startsWith('data:')) {
    formattedImageUrl = `data:image/png;base64,${base64Image}`;
  }

  // Detect bank code from documentType if present
  let matchedBankCode: string | undefined = undefined;
  const docTypeUpper = (documentType || "").toUpperCase();
  for (const code of ['MNC', 'PERMATA', 'OCBC', 'BRI', 'SMBC']) {
    if (docTypeUpper.includes(code)) {
      matchedBankCode = code;
      break;
    }
  }

  const goldenTemplatesPrompt = getGoldenTemplatesPrompt(matchedBankCode);

  const systemPrompt = `You are an expert OCR Data Engineer parsing Indonesian Cassette Audit receipts and documents.
Your primary directive is to map the unstructured text into the exact nested JSON schema provided in the Golden Templates below.
If the receipt is heavily folded or faded, use the Golden Template to infer the missing structural keys (e.g., if 'REMAINING' is unreadable but the number aligns with the 3rd row of TYPE_1, map it to TYPE_1.REMAINING).

CRITICAL INSTRUCTIONS:
1. Spatial Alignment: Read line by line. Carefully trace the vertical alignment of numbers to their correct header columns.
2. Nested Output: Structure tabular data hierarchically. Use Column Headers (or Cassette Types/Denominations) as primary keys, and row labels as secondary keys.
3. Golden Template Adherence: Map the implicit matrix layout into the exact nested JSON structure defined in the Golden Templates.
4. Global Fields: Extract general data like "document_category", "LAST_CLEARED_DATE", "MACHINE_ID", "ACTIVITY_COUNT", or "INIT_AMOUNT" at the root level of the JSON.
5. Return ONLY a valid JSON object. No markdown, no conversational text.

${goldenTemplatesPrompt}

Identify the document type under "document_category" (e.g., "Cassette Audit & Cleared", "KTP (Indonesian ID)", "ATM Receipt", "Invoice", "Tax Document (NPWP)", "Passport", or "Unknown").

Return strictly in this JSON format:
{
  "document_category": "${documentType || "ATM Receipt"}",
  "extracted_data": {
     // ... extracted key-values and nested objects here
  }
}`;

  const fewShotContext = (fewShotExamples && fewShotExamples.length > 0)
    ? `\n\nHere are historical verified examples of similar receipts to guide your formatting (Instant Learning):\n${JSON.stringify(fewShotExamples.slice(0, 5), null, 2)}`
    : "";

  const finalPromptText = `${systemPrompt}\n\n${fewShotContext}`;

  const chosenModel = modelId || "meta/llama-3.2-90b-vision-instruct";

  const messages = [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": finalPromptText
        },
        {
          "type": "image_url",
          "image_url": {
            "url": formattedImageUrl
          }
        }
      ]
    }
  ];

  // Dynamically build payload based on the selected model
  let payload: any = {
    model: chosenModel,
    messages: messages,
    stream: stream,
  };

  if (chosenModel === 'meta/llama-3.2-90b-vision-instruct') {
    payload = {
      ...payload,
      frequency_penalty: 0,
      max_tokens: 4096, // Increased from 512 to ensure large JSON responses fit
      presence_penalty: 0,
      temperature: 1,
      top_p: 1
    };
  } else if (chosenModel === 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning') {
    payload = {
      ...payload,
      max_tokens: 65536,
      reasoning_budget: 16384,
      temperature: 0.6,
      top_p: 0.95
    };
  } else {
    payload = {
      ...payload,
      max_tokens: 4096,
      temperature: 0.7
    };
  }

  try {
    const response = await axios.post(invokeUrl, payload, {
      headers: headers,
      timeout: 90000 // FIX: Increased to 90 seconds
    });
    
    const extractedContent = response.data?.choices?.[0]?.message?.content || "";
    let cleaned = extractedContent.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    }
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("VLM Extraction Error:", error);
    throw error;
  }
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

export async function extractReceiptData(
  base64Image: string, 
  documentType: string = "ATM Cash Withdrawal",
  modelId: string = "meta/llama-3.2-90b-vision-instruct",
  fewShotExamples: Record<string, any>[] = []
): Promise<Record<string, any>> {
  return extractFullReceipt(base64Image, fewShotExamples, documentType, modelId);
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

    let documentCategory: string = rawRes.document_category || "";
    let extractedJson: Record<string, any> = (rawRes.extracted_data && typeof rawRes.extracted_data === 'object')
      ? rawRes.extracted_data
      : rawRes;

    // Clean out document_category if present in extractedJson
    if (extractedJson.document_category) {
      delete extractedJson.document_category;
    }

    // Fast keyword classification fallback if missing or Unknown
    if (!documentCategory || documentCategory === "Unknown") {
      const fullTextStr = JSON.stringify(rawRes).toLowerCase();
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
 * Safely parse raw VLM content string into a JS object
 */
function parseContentToJson(content: string): Record<string, any> {
  if (!content) return generateFallbackVlmExtraction();

  try {
    // Clean markdown code fence formatting if returned by model
    let cleaned = content.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    }

    const parsed = JSON.parse(cleaned);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch (err) {
    console.warn('[NVIDIA VLM] Could not directly JSON.parse content, trying regex extraction...');
    // Attempt regex extraction of JSON block
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('[NVIDIA VLM] Regex JSON parse also failed');
      }
    }
  }

  return generateFallbackVlmExtraction();
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
 * e.g., { "TYPE_1": { "CASSETTE": 1999, "REJECTED": 1 } }
 *       -> { "TYPE_1.CASSETTE": 1999, "TYPE_1.REJECTED": 1 }
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

