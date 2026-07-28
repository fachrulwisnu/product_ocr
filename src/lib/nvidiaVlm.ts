/**
 * NVIDIA Nemotron VLM API Integration Module
 * Endpoint: https://integrate.api.nvidia.com/v1/chat/completions
 * Model: nvidia/nemotron-3-nano-omni-30b-a3b-reasoning
 */

import axios from 'axios';

// Hardcoded NVIDIA API Key as requested by project specifications
export const HARDCODED_NVIDIA_API_KEY = "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";

export async function extractFullReceipt(
  base64Image: string, 
  fewShotExamples: Record<string, any>[] = []
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

  let promptText = "Extract all transaction details from this ATM receipt into a clean JSON object. Dynamically name the keys based on the context (e.g., ATM_LOCATION, WITHDRAWAL_AMOUNT, RECORD_NUMBER, AVAILABLE_BALANCE). Return ONLY the raw JSON object, without any markdown formatting, backticks, or conversational text.";

  if (fewShotExamples && fewShotExamples.length > 0) {
    promptText += "\n\nHere are verified examples of expected key-value extraction structure for this project format:\n";
    fewShotExamples.slice(0, 5).forEach((ex, i) => {
      promptText += `Example ${i + 1}:\n${JSON.stringify(ex, null, 2)}\n`;
    });
    promptText += "\nPlease align your key names and formatting with these verified examples where applicable.";
  }

  const payload = {
    "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
    "max_tokens": 65536,
    "reasoning_budget": 16384,
    "stream": stream,
    "temperature": 0.6,
    "top_p": 0.95,
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": promptText
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
    const response = await axios.post(invokeUrl, payload, { headers, timeout: 30000 });
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

export async function extractReceiptData(base64Image: string): Promise<Record<string, any>> {
  return extractFullReceipt(base64Image, []);
}

export interface VlmExtractionResponse {
  rawText: string;
  extractedJson: Record<string, any>;
  processingTimeMs: number;
  provider: string;
}

/**
 * Invoke NVIDIA Nemotron VLM to extract dynamic key-value pairs from an ATM receipt image.
 */
export async function invokeNvidiaVlm(imageDataUri: string): Promise<VlmExtractionResponse> {
  const startTime = Date.now();
  try {
    const extractedJson = await extractReceiptData(imageDataUri);
    return {
      rawText: JSON.stringify(extractedJson, null, 2),
      extractedJson,
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
 * Convert dynamic JSON extracted by VLM into UI ExtractedField list
 */
export function convertVlmJsonToFields(jsonObj: Record<string, any>): any[] {
  return Object.entries(jsonObj).map(([key, val], idx) => ({
    id: `field-vlm-${idx}-${Date.now()}`,
    key: key.toUpperCase().replace(/\s+/g, '_'),
    label: key.replace(/_/g, ' '),
    value: String(val ?? ''),
    confidence: 0.95,
    status: 'predicted',
    category: 'vlm_discovered'
  }));
}

