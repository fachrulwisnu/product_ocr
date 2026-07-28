/**
 * Types for ATM Receipt OCR Annotation Platform
 */

export type ReceiptType = string;

export type ReviewStatus = 'pending_ocr' | 'needs_review' | 'approved' | 'rejected';

export interface BoundingBox {
  // [x1, y1, x2, y2] in percentages (0 to 100) relative to image dimensions
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface OCRWord {
  id: string;
  text: string;
  box: BoundingBox;
  confidence: number;
}

export interface OCRLine {
  id: string;
  text: string;
  box: BoundingBox;
  words: OCRWord[];
  confidence: number;
}

export interface OCRResult {
  rawText: string;
  lines: OCRLine[];
  width: number;
  height: number;
  engine: 'NVIDIA NIM OCR API' | 'NVIDIA NIM OCR (Simulated Fallback)';
  processedAt: string;
}

export type FieldStatus = 'auto' | 'human_verified' | 'edited' | 'manual_added';

export interface ExtractedField {
  id: string;
  key: string;              // e.g., 'ATM_ID', 'TRANSACTION_DATE', 'AMOUNT'
  label: string;            // Human readable label e.g. "ATM Terminal ID"
  value: string;
  confidence: number;       // 0 to 1
  box?: BoundingBox;
  ocrWordIds?: string[];
  status: FieldStatus;
  category: 'header' | 'transaction' | 'financial' | 'cassette' | 'other' | 'vlm_discovered' | 'google_lens_crop';
}

export interface ReceiptImage {
  id: string;
  projectId: string;
  fileName: string;
  receiptType: ReceiptType;
  fileUrl: string;          // Data URL or remote image URL
  uploadDate: string;
  status: ReviewStatus;
  overallConfidence: number;
  ocrData: OCRResult;
  fields: ExtractedField[];
  isTrainingSample: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  receiptType: ReceiptType;
  createdAt: string;
  trainedSampleCount: number;
  modelAccuracy: number;     // e.g. 92.5 (%)
  modelStatus: 'untrained' | 'training' | 'trained';
  modelVersion: string;      // e.g., "v1.0.4"
  updatedAt: string;
}

export interface TrainingEpoch {
  epoch: number;
  loss: number;
  accuracy: number;
  valLoss: number;
}

export interface TrainingJob {
  id: string;
  projectId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;          // 0 to 100
  currentEpoch: number;
  totalEpochs: number;
  samplesCount: number;
  accuracyBefore: number;
  accuracyAfter: number;
  epochs: TrainingEpoch[];
  startedAt: string;
  completedAt?: string;
  modelName: string;         // e.g. "LayoutLMv3-ATM-Custom-v2"
}

export interface ActivityLog {
  id: string;
  projectId: string;
  action: 'upload' | 'ocr_processed' | 'field_edited' | 'sample_approved' | 'training_started' | 'training_completed' | 'export';
  user: string;
  timestamp: string;
  details: string;
}

export interface PlatformMetrics {
  totalProjects: number;
  totalImages: number;
  trainedSamplesCount: number;
  averageAccuracy: number;
  pendingReviewsCount: number;
  approvedCount: number;
  rejectedCount: number;
  activeModelVersion: string;
}
