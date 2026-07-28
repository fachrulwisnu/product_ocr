import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { randomUUID } from 'crypto';
import { createServer as createViteServer } from 'vite';
import { invokeNvidiaVlm, convertVlmJsonToFields, HARDCODED_NVIDIA_API_KEY, extractReceiptData } from './src/lib/nvidiaVlm';
import { predictFieldsFromOCR, runInstantLearningTraining } from './src/lib/extractionEngine';
import { INITIAL_PROJECTS, INITIAL_RECEIPT_IMAGES, generateReceiptSVG } from './src/data/sampleReceipts';
import { Project, ReceiptImage, ActivityLog, PlatformMetrics, TrainingJob } from './src/types';
import { apiRateLimiter } from './src/middleware/rateLimiter';
import { errorHandler } from './src/middleware/errorHandler';
import projectsV1Router from './src/routes/v1/projects.route';
import imagesV1Router from './src/routes/v1/images.route';
import ocrV1Router from './src/routes/v1/ocr.route';
import templatesV1Router from './src/routes/v1/templates.route';

const app = express();
const PORT = 3000;

// Security & Logging Middlewares
app.use(helmet({ contentSecurityPolicy: false })); // Disable CSP strict for Vite inline scripts in dev
app.use(cors());
app.use(morgan('dev'));
app.use('/api', apiRateLimiter);

// Enable JSON body parser with increased limit for image base64 uploads
app.use(express.json({ limit: '50mb' }));

// Mount V1 API Routes
app.use('/api/v1/projects', projectsV1Router);
app.use('/api/v1/images', imagesV1Router);
app.use('/api/v1/ocr', ocrV1Router);
app.use('/api/v1/templates', templatesV1Router);

// In-Memory Data Store (Initialized with pre-loaded ATM receipts)
let projectsStore: Project[] = [...INITIAL_PROJECTS];
let imagesStore: ReceiptImage[] = [...INITIAL_RECEIPT_IMAGES];
let trainingJobsStore: TrainingJob[] = [];
let activityLogsStore: ActivityLog[] = [
  {
    id: randomUUID(),
    projectId: 'a0000000-0000-4000-a000-000000000001',
    action: 'upload',
    user: 'Senior AI Engineer',
    timestamp: '2026-07-27T10:12:00Z',
    details: 'Uploaded ATM_Withdrawal_Receipt_001.png'
  },
  {
    id: randomUUID(),
    projectId: 'a0000000-0000-4000-a000-000000000001',
    action: 'ocr_processed',
    user: 'NVIDIA NIM OCR API',
    timestamp: '2026-07-27T10:12:05Z',
    details: 'Executed NVIDIA NIM OCR API bounding box extraction'
  },
  {
    id: randomUUID(),
    projectId: 'a0000000-0000-4000-a000-000000000001',
    action: 'training_completed',
    user: 'Instant Learning Engine',
    timestamp: '2026-07-27T18:30:00Z',
    details: 'Model trained on 4 human-corrected receipt samples (Accuracy: 94.8%)'
  }
];

// Helper to add activity log
function logActivity(projectId: string, action: ActivityLog['action'], details: string, user = 'Operator') {
  activityLogsStore.unshift({
    id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    projectId,
    action,
    user,
    timestamp: new Date().toISOString(),
    details
  });
}

// ----------------------------------------------------
// REST API ROUTES
// ----------------------------------------------------

// Scalar Interactive API Reference Documentation
app.get('/docs', (req, res) => {
  res.send(`
    <!doctype html>
    <html>
      <head>
        <title>ATM Receipt & Invoice AI API Documentation</title>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <script
          id="api-reference"
          data-url="/openapi.json"
        ></script>
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
      </body>
    </html>
  `);
});

// OpenAPI 3.0 Specification Endpoint
app.get('/openapi.json', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: {
      title: 'AI Document & Receipt Extraction API',
      version: '1.0.0',
      description: 'REST API for multi-model AI extraction (Nemotron 3 Ultra, OCR v2, Llama Vision) with Instant Learning.'
    },
    paths: {
      '/api/extract': {
        post: {
          summary: 'Extract Receipt or Invoice Data',
          description: 'Supports mobile app auto-detection (leave documentCategory empty or set to AUTO).',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    base64Image: { type: 'string', description: 'Base64 encoded string of the receipt or invoice image.' },
                    documentCategory: { type: 'string', description: 'Optional. Bank category or "AUTO" for auto-detection.', example: 'AUTO' },
                    modelId: { type: 'string', description: 'Model ID to use', example: 'nvidia/nemotron-3-ultra-550b-a55b' }
                  },
                  required: ['base64Image']
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Successful JSON extraction',
              content: {
                'application/json': {
                  schema: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }
  });
});

// Direct Extraction Endpoint for Mobile & Web External Integrations
app.post('/api/extract', async (req, res) => {
  try {
    const { base64Image, imageData, documentCategory, modelId } = req.body;
    const imgData = base64Image || imageData;
    if (!imgData) {
      return res.status(400).json({ error: 'base64Image or imageData is required' });
    }

    const chosenModel = modelId || 'nvidia/nemotron-3-ultra-550b-a55b';
    const result = await extractReceiptData(imgData, documentCategory, chosenModel);
    res.json({
      success: true,
      data: result
    });
  } catch (err: any) {
    console.error('Error in /api/extract:', err);
    res.status(500).json({ success: false, error: err.message || 'Extraction failed' });
  }
});

// 1. Health & Config Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    nvidiaApiKeyConfigured: Boolean(HARDCODED_NVIDIA_API_KEY),
    nvidiaModel: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
    nvidiaEndpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    timestamp: new Date().toISOString()
  });
});

// 2. Platform Metrics & Dashboard Data
app.get('/api/metrics', (req, res) => {
  const totalProjects = projectsStore.length;
  const totalImages = imagesStore.length;
  const trainedSamplesCount = imagesStore.filter(i => i.isTrainingSample || i.status === 'approved').length;
  const approvedCount = imagesStore.filter(i => i.status === 'approved').length;
  const pendingReviewsCount = imagesStore.filter(i => i.status === 'needs_review').length;
  const rejectedCount = imagesStore.filter(i => i.status === 'rejected').length;

  const avgAcc = projectsStore.reduce((acc, p) => acc + p.modelAccuracy, 0) / (totalProjects || 1);

  const metrics: PlatformMetrics = {
    totalProjects,
    totalImages,
    trainedSamplesCount,
    averageAccuracy: Math.round(avgAcc * 10) / 10,
    pendingReviewsCount,
    approvedCount,
    rejectedCount,
    activeModelVersion: 'LayoutLMv3-NvidiaOCR-v1.2'
  };

  res.json({
    metrics,
    recentActivity: activityLogsStore.slice(0, 10),
    activeJobs: trainingJobsStore.filter(j => j.status === 'processing')
  });
});

// 3. Projects List & Create
app.get('/api/projects', (req, res) => {
  res.json(projectsStore);
});

app.post('/api/projects', (req, res) => {
  const { name, description, receiptType } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const newProj: Project = {
    id: randomUUID(),
    name,
    description: description || 'ATM receipt extraction project powered by NVIDIA NIM OCR',
    receiptType: receiptType || 'ATM Cash Withdrawal',
    createdAt: new Date().toISOString(),
    trainedSampleCount: 0,
    modelAccuracy: 70.0,
    modelStatus: 'untrained',
    modelVersion: 'v1.0.0',
    updatedAt: new Date().toISOString()
  };

  projectsStore.unshift(newProj);
  logActivity(newProj.id, 'upload', `Created new project "${newProj.name}"`);

  res.status(201).json(newProj);
});

// 4. Images List & Retrieve
app.get('/api/images', (req, res) => {
  const { projectId, status } = req.query;
  let filtered = [...imagesStore];

  if (projectId) {
    filtered = filtered.filter(img => img.projectId === projectId);
  }
  if (status) {
    filtered = filtered.filter(img => img.status === status);
  }

  res.json(filtered);
});

app.get('/api/images/:id', (req, res) => {
  const image = imagesStore.find(img => img.id === req.params.id);
  if (!image) {
    return res.status(404).json({ error: 'Image not found' });
  }
  res.json(image);
});

// 5. Upload Image & Process VLM Direct Extraction
app.post('/api/upload', async (req, res) => {
  try {
    const { projectId, fileName, receiptType, imageData, modelId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const proj = projectsStore.find(p => p.id === projectId);
    if (!proj) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Default image if missing or custom upload
    const imageContent = imageData || generateReceiptSVG('FIRST NATIONAL BANK', receiptType || 'CASH WITHDRAWAL', 'ATM-9102-LA', '$100.00', '$2,150.00', '5', '0');

    const docCategory = receiptType || proj.receiptType || 'ATM Cash Withdrawal';
    const chosenModel = modelId || 'meta/llama-3.2-90b-vision-instruct';

    console.log(`[API /api/upload] Invoking NVIDIA VLM (${chosenModel}) for ${fileName || 'Document.png'} (${docCategory})...`);
    
    // Call NVIDIA VLM for direct key-value reasoning with dynamic document category
    const vlmResponse = await invokeNvidiaVlm(imageContent, docCategory, [], chosenModel);
    const fields = convertVlmJsonToFields(vlmResponse.extractedJson);

    const newImg: ReceiptImage = {
      id: randomUUID(),
      projectId,
      fileName: fileName || `Document_${Date.now()}.png`,
      receiptType: docCategory,
      fileUrl: imageContent,
      uploadDate: new Date().toISOString(),
      status: 'needs_review',
      overallConfidence: 0.96,
      ocrData: {
        rawText: vlmResponse.rawText,
        lines: [],
        width: 800,
        height: 1200,
        engine: 'NVIDIA NIM OCR API',
        processedAt: new Date().toISOString()
      },
      fields,
      isTrainingSample: false
    };

    imagesStore.unshift(newImg);
    logActivity(projectId, 'upload', `Uploaded image ${newImg.fileName}`);
    logActivity(projectId, 'ocr_processed', `NVIDIA VLM (${chosenModel}) extraction completed for ${newImg.fileName}`);

    res.status(201).json({
      ...newImg,
      vlmResult: vlmResponse
    });
  } catch (err: any) {
    console.error('Error in /api/upload:', err);
    return res.status(500).json({ success: false, message: err?.message || 'Failed to process receipt upload and VLM extraction' });
  }
});

// 5b. Direct VLM Completion Route
app.post('/api/vlm', async (req, res) => {
  try {
    const { image, documentType, modelId } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'image base64 or data URI is required' });
    }

    const chosenModel = modelId || 'meta/llama-3.2-90b-vision-instruct';
    console.log(`[API /api/vlm] Executing NVIDIA VLM (${chosenModel}) completion for ${documentType || 'General Document'}...`);
    const result = await invokeNvidiaVlm(image, documentType || 'ATM Cash Withdrawal', [], chosenModel);
    res.json(result);
  } catch (err: any) {
    console.error('Error in /api/vlm:', err);
    return res.status(500).json({ success: false, message: err?.message || 'VLM completion failed' });
  }
});

// 6. Direct VLM Test Route
app.post('/api/ocr', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, message: 'image base64 or SVG data is required' });
    }
    const result = await invokeNvidiaVlm(image);
    res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err?.message || 'VLM extraction failed' });
  }
});

// 7. AI Field Prediction Endpoint
app.post('/api/predict', (req, res) => {
  try {
    const { ocrData, projectId } = req.body;
    if (!ocrData) {
      return res.status(400).json({ error: 'ocrData is required' });
    }
    const proj = projectsStore.find(p => p.id === projectId);
    const accuracyBoost = proj ? (proj.modelAccuracy - 70) : 0;

    const fields = predictFieldsFromOCR(ocrData, undefined, accuracyBoost);
    res.json({ fields, confidence: 0.89 + (accuracyBoost / 200) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Prediction failed' });
  }
});

// 8. Human Review / Update Labels
app.put('/api/images/:id/labels', (req, res) => {
  const { id } = req.params;
  const { fields, status, notes, reviewedBy } = req.body;

  const imgIndex = imagesStore.findIndex(i => i.id === id);
  if (imgIndex === -1) {
    return res.status(404).json({ error: 'Image not found' });
  }

  const currentImg = imagesStore[imgIndex];
  
  if (fields) {
    currentImg.fields = fields;
  }
  if (status) {
    currentImg.status = status;
    if (status === 'approved') {
      currentImg.isTrainingSample = true;
    }
  }
  if (notes) currentImg.notes = notes;
  if (reviewedBy) currentImg.reviewedBy = reviewedBy;
  currentImg.reviewedAt = new Date().toISOString();

  imagesStore[imgIndex] = currentImg;

  // Update project trained sample count
  const projIndex = projectsStore.findIndex(p => p.id === currentImg.projectId);
  if (projIndex !== -1) {
    const projSamples = imagesStore.filter(i => i.projectId === currentImg.projectId && (i.isTrainingSample || i.status === 'approved')).length;
    projectsStore[projIndex].trainedSampleCount = projSamples;
  }

  logActivity(currentImg.projectId, 'field_edited', `Updated annotations for ${currentImg.fileName} (Status: ${currentImg.status})`);

  res.json(currentImg);
});

// 9. Instant Learning / Training Trigger
app.post('/api/train', async (req, res) => {
  try {
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const projIndex = projectsStore.findIndex(p => p.id === projectId);
    if (projIndex === -1) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const currentProj = projectsStore[projIndex];
    const projectSamples = imagesStore.filter(i => i.projectId === projectId && (i.isTrainingSample || i.status === 'approved'));

    if (projectSamples.length < 1) {
      return res.status(400).json({ error: 'Minimum 1-3 approved human-corrected samples required for training' });
    }

    currentProj.modelStatus = 'training';
    logActivity(projectId, 'training_started', `Started instant learning training job on ${projectSamples.length} samples`);

    // Execute instant learning background loop
    const trainingJob = await runInstantLearningTraining(
      projectId,
      projectSamples.length,
      currentProj.modelAccuracy
    );

    trainingJobsStore.unshift(trainingJob);

    // Update project state with trained metrics
    currentProj.modelStatus = 'trained';
    currentProj.modelAccuracy = trainingJob.accuracyAfter;
    currentProj.modelVersion = `v1.${Math.floor(currentProj.trainedSampleCount / 2 + 1)}.0`;
    currentProj.updatedAt = new Date().toISOString();
    projectsStore[projIndex] = currentProj;

    // Recalculate predictions for all pending review images in this project
    imagesStore.forEach(img => {
      if (img.projectId === projectId && img.status === 'needs_review') {
        img.fields = predictFieldsFromOCR(img.ocrData, undefined, currentProj.modelAccuracy - 70);
        img.overallConfidence = Math.min(0.98, img.overallConfidence + 0.12);
      }
    });

    logActivity(projectId, 'training_completed', `Completed training. Accuracy boosted from ${trainingJob.accuracyBefore}% to ${trainingJob.accuracyAfter}%!`);

    res.json({
      job: trainingJob,
      project: currentProj,
      message: `Instant learning model successfully trained on ${projectSamples.length} samples!`
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Training failed' });
  }
});

// 10. Dataset Export (JSON, CSV, Excel format)
app.post('/api/export', (req, res) => {
  const { projectId, format } = req.body; // 'json' | 'csv' | 'excel'
  const targetImages = projectId ? imagesStore.filter(i => i.projectId === projectId) : imagesStore;

  if (format === 'csv') {
    let csvLines = ['Image_ID,File_Name,Receipt_Type,Status,Field_Key,Field_Label,Extracted_Value,Confidence,Box_x1,Box_y1,Box_x2,Box_y2'];
    targetImages.forEach(img => {
      img.fields.forEach(f => {
        const boxStr = f.box ? `${f.box.x1},${f.box.y1},${f.box.x2},${f.box.y2}` : '0,0,0,0';
        const escapedVal = `"${(f.value || '').replace(/"/g, '""')}"`;
        csvLines.push(`${img.id},${img.fileName},${img.receiptType},${img.status},${f.key},"${f.label}",${escapedVal},${f.confidence},${boxStr}`);
      });
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="Nanonets_ATM_Receipt_Dataset.csv"');
    return res.send(csvLines.join('\n'));
  }

  // Default JSON export
  res.json({
    exportedAt: new Date().toISOString(),
    totalSamples: targetImages.length,
    dataset: targetImages.map(img => ({
      id: img.id,
      fileName: img.fileName,
      receiptType: img.receiptType,
      status: img.status,
      overallConfidence: img.overallConfidence,
      ocrText: img.ocrData.rawText,
      annotations: img.fields.map(f => ({
        key: f.key,
        label: f.label,
        value: f.value,
        confidence: f.confidence,
        box: f.box,
        status: f.status
      }))
    }))
  });
});


// Global Express Error Handler Middleware
app.use(errorHandler);

// ----------------------------------------------------
// VITE MIDDLEWARE / STATIC SERVING
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Nanonets ATM Receipt OCR Platform] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
