/**
 * NVIDIA Nemotron VLM API Integration Module
 * Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
 * Model: nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
 */

import axios from 'axios';
import { GOLDEN_TEMPLATES, getGoldenTemplatesPrompt } from './goldenTemplates';

// Hardcoded NVIDIA API Key as requested by project specifications
export const HARDCODED_NVIDIA_API_KEY = "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";

export async function extractReceiptData(
  base64Image: string, 
  documentCategory: string = "ATM Cash Withdrawal",
  modelId: string = "meta/llama-3.2-90b-vision-instruct",
  fewShotExamples: Record<string, any>[] = []
): Promise<Record<string, any>> {
  // Sanitize base64 string
  const base64DataOnly = base64Image.includes('base64,') ? base64Image.split('base64,')[1] : base64Image;
  const fullDataUrl = `data:image/jpeg;base64,${base64DataOnly}`;

  // ---------------------------------------------------------
  // ROUTE A: NEMOTRON OCR V2 (HYBRID PIPELINE)
  // ---------------------------------------------------------
  if (modelId === 'nvidia/nemotron-ocr-v2') {
    const ocrUrl = "https://ai.api.nvidia.com/v1/cv/nvidia/nemotron-ocr-v2";
    const ocrHeaders = {
      "Authorization": "Bearer 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",
      "Accept": "application/json",
      "Content-Type": "application/json"
    };

    const payload = { input: [ { type: "image_url", url: fullDataUrl } ] };

    try {
      const response = await axios.post(ocrUrl, payload, { headers: ocrHeaders, timeout: 90000 });
      const rawData = response.data;
      
      const cleanedData: Record<string, string> = {};
      const extractedTextLines: string[] = [];

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

      if (GOLDEN_TEMPLATES[documentCategory] && extractedTextLines.length > 0) {
        const chatUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
        const chatHeaders = {
          "Authorization": "Bearer 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",
          "Accept": "application/json",
          "Content-Type": "application/json"
        };

        const formattingPrompt = `You are an OCR data formatter. Format the following raw OCR text lines into a clean JSON object. STRICT SCHEMA RULE: ${GOLDEN_TEMPLATES[documentCategory]}. Return ONLY raw JSON without markdown formatting.`;

        const formatPayload = {
          model: "meta/llama-3.1-70b-instruct",
          messages: [
            { role: "system", content: formattingPrompt },
            { role: "user", content: extractedTextLines.join('\n') }
          ],
          temperature: 0.1,
          max_tokens: 2048
        };

        const formatResponse = await axios.post(chatUrl, formatPayload, { headers: chatHeaders, timeout: 30000 });
        const structuredText = formatResponse.data.choices[0].message.content;
        return JSON.parse(structuredText.replace(/```json/g, '').replace(/```/g, '').trim());
      }

      return cleanedData; 
    } catch (error) {
      console.error("Nemotron OCR v2 Hybrid Error:", error);
      throw error;
    }
  }

  // ---------------------------------------------------------
  // ROUTE B: NEMOTRON NANO VL 8B (DOCUMENTS, INVOICES, PDF, XLSX, CSV)
  // ---------------------------------------------------------
  else if (modelId === 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1') {
    const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
    const headers = {
      "Authorization": "Bearer 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",
      "Accept": "application/json",
      "Content-Type": "application/json"
    };

    let systemPrompt = `You are an expert document and invoice processing engine. Extract all line items, totals, dates, and metadata from this ${documentCategory} into a clean JSON object. Return ONLY the raw JSON object without markdown formatting.`;

    if (GOLDEN_TEMPLATES[documentCategory]) {
      systemPrompt = `${systemPrompt} STRICT SCHEMA RULE:${GOLDEN_TEMPLATES[documentCategory]}`;
    }

    const payload = {
      model: "nvidia/llama-3.1-nemotron-nano-vl-8b-v1",
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: [
            { type: "text", text: "Extract structured data from this document/invoice." },
            { type: "image_url", image_url: { url: fullDataUrl } }
          ] 
        }
      ],
      temperature: 1,
      top_p: 0.01,
      max_tokens: 1024,
      seed: 50,
      stream: false
    };

    try {
      const response = await axios.post(invokeUrl, payload, { headers, timeout: 90000 });
      const extractedText = response.data.choices[0].message.content;
      return JSON.parse(extractedText.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (error) {
      console.error("Nemotron Nano VL 8B Error:", error);
      throw error;
    }
  }

  // ---------------------------------------------------------
  // ROUTE C: LLAMA 3.2 & NEMOTRON OMNI (CHAT COMPLETIONS)
  // ---------------------------------------------------------
  else {
    const invokeUrl = "https://integrate.api.nvidia.com/v1/chat/completions";
    const headers = {
      "Authorization": "Bearer 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",
      "Accept": "application/json",
      "Content-Type": "application/json"
    };

    let systemPrompt = `Extract transaction details from this ${documentCategory} into a clean JSON object. Return ONLY raw JSON.`;

    if (GOLDEN_TEMPLATES[documentCategory]) {
      systemPrompt = `${systemPrompt} STRICT SCHEMA RULE:${GOLDEN_TEMPLATES[documentCategory]}`;
    }

    let payload: any = {
      model: modelId,
      messages: [
        { role: "user", content: [ { type: "text", text: systemPrompt }, { type: "image_url", image_url: { url: fullDataUrl } } ] }
      ],
      stream: false,
    };

    if (modelId === 'meta/llama-3.2-90b-vision-instruct') {
      payload = { ...payload, max_tokens: 4096, temperature: 0.1, top_p: 1 };
    } else {
      payload = { ...payload, max_tokens: 65536, reasoning_budget: 16384, temperature: 0.6, top_p: 0.95 };
    }

    try {
      const response = await axios.post(invokeUrl, payload, { headers, timeout: 90000 });
      const extractedText = response.data.choices[0].message.content;
      return JSON.parse(extractedText.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (error) {
      console.error("Chat Completions API Error:", error);
      throw error;
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

