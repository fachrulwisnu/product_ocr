import axios from 'axios';

// Hardcoded NVIDIA API Key as specified in Phase 3 Task 2
export const HARDCODED_NVIDIA_OCR_API_KEY = "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";
export const NVIDIA_NEMOTRON_OCR_ENDPOINT = "https://ai.api.nvidia.com/v1/cv/nvidia/nemotron-ocr-v2";

export interface OcrDetectedBlock {
  text_content: string;
  confidence: number;
  box_x: number;      // Percentage (0-100) or pixel X
  box_y: number;      // Percentage (0-100) or pixel Y
  box_width: number;  // Percentage (0-100) or pixel Width
  box_height: number; // Percentage (0-100) or pixel Height
}

export interface OcrProcessResult {
  raw_text: string;
  raw_json_response: any;
  blocks: OcrDetectedBlock[];
  processing_time_ms: number;
}

/**
 * Service function to process image buffer/base64 using NVIDIA Nemotron OCR v2
 */
export async function processNvidiaNemotronOcr(
  base64Image: string,
  fileName: string = 'receipt.jpg'
): Promise<OcrProcessResult> {
  const startTime = Date.now();

  // Strip data URL prefix if present
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

  try {
    const payload = {
      image: cleanBase64,
      options: {
        return_bounding_boxes: true,
        language: 'en'
      }
    };

    const response = await axios.post(NVIDIA_NEMOTRON_OCR_ENDPOINT, payload, {
      headers: {
        'Authorization': `Bearer ${HARDCODED_NVIDIA_OCR_API_KEY}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 12000
    });

    const endTime = Date.now();
    const processingTimeMs = endTime - startTime;
    const rawData = response.data;

    const blocks: OcrDetectedBlock[] = [];
    let fullTextLines: string[] = [];

    // Parse NVIDIA Nemotron OCR response text_detections or predictions array
    const detections = rawData.text_detections || rawData.detections || rawData.predictions || [];

    if (Array.isArray(detections) && detections.length > 0) {
      detections.forEach((item: any) => {
        const text = item.text || item.label || item.text_content || '';
        const confidence = typeof item.confidence === 'number' ? item.confidence : (item.score || 0.95);
        
        // Coordinates can be vertices [[x1,y1],[x2,y2],[x3,y3],[x4,y4]] or bbox [x,y,w,h] or box_x...
        let x = 10;
        let y = 10;
        let w = 80;
        let h = 5;

        if (item.bbox && Array.isArray(item.bbox)) {
          [x, y, w, h] = item.bbox;
        } else if (item.vertices && Array.isArray(item.vertices) && item.vertices.length >= 4) {
          const xs = item.vertices.map((v: number[]) => v[0]);
          const ys = item.vertices.map((v: number[]) => v[1]);
          const minX = Math.min(...xs);
          const maxX = Math.max(...xs);
          const minY = Math.min(...ys);
          const maxY = Math.max(...ys);
          x = minX;
          y = minY;
          w = maxX - minX;
          h = maxY - minY;
        } else {
          x = item.box_x ?? item.x ?? 10;
          y = item.box_y ?? item.y ?? 10;
          w = item.box_width ?? item.width ?? 80;
          h = item.box_height ?? item.height ?? 5;
        }

        if (text) {
          fullTextLines.push(text);
          blocks.push({
            text_content: text,
            confidence,
            box_x: Number(x.toFixed(2)),
            box_y: Number(y.toFixed(2)),
            box_width: Number(w.toFixed(2)),
            box_height: Number(h.toFixed(2))
          });
        }
      });
    }

    return {
      raw_text: fullTextLines.join('\n'),
      raw_json_response: rawData,
      blocks,
      processing_time_ms: processingTimeMs
    };
  } catch (err: any) {
    console.error(`[NVIDIA Nemotron OCR API Error] (${err?.message})`);
    return {
      raw_text: '',
      raw_json_response: { error: err?.message || 'OCR processing failed' },
      blocks: [],
      processing_time_ms: Date.now() - startTime
    };
  }
}
