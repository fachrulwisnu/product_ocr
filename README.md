# Nanonets Enterprise ATM Receipt Document AI Platform

Enterprise Vision-Language Model (VLM) & Computer Vision (CV) Document AI Platform powered by **NVIDIA AI Models** (Nemotron OCR v2, Llama 3.1 70B, Llama 3.2 90B Vision, Nemotron 3 Ultra 550B), Express.js backend, and Supabase database.

---

## 🌟 Key Platform Capabilities

### 1. Enterprise Multi-Model VLM Router & Hybrid Formatter
- **Route A (Computer Vision OCR + Hybrid LLM):** Uses `nvidia/nemotron-ocr-v2` (`https://ai.api.nvidia.com/v1/cv/nvidia/nemotron-ocr-v2`) for raw text detection and bounding box coordinate extraction. Next, clean text lines are intercepted and formatted into structured JSON using `meta/llama-3.1-70b-instruct`.
- **Route B (Advanced Reasoning Model):** Direct connection to `nvidia/nemotron-3-ultra-550b-a55b` via OpenAI SDK with `enable_thinking` enabled and a 16k reasoning token budget.
- **Route C (Standard Vision LLMs):** Direct multimodal extraction using `meta/llama-3.2-90b-vision-instruct` or `nvidia/nemotron-nano-vl`.

### 2. OCR Auto-Classification & Dynamic Template Engine
- **Keywords Vector Matching:** Automatically scans raw text detections from Nemotron OCR against registered template keywords (e.g., `["CIMB", "CASSETTE"]` or `["BCA", "TARIK"]`).
- **Dynamic Schema Rules:** Automatically applies schema instructions registered in `receipt_templates_ocr` for the detected bank or receipt type.
- **Template Manager UI:** Comprehensive dashboard view allowing operators to manage Bank Categories and Receipt Schema Rules with live keyword trigger configurations.

### 3. Interactive Bounding Box & Crop Region Studio
- **Overlay Visualizer:** Interactive SVG overlay rendering normalized bounding box coordinates directly on uploaded ATM receipts.
- **Cropped Region Extraction:** Select any custom bounding box on a document image to trigger instant isolated region reading powered by `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`.

### 4. Few-Shot Instant Learning Dataset Manager
- **Verified Examples Library:** Store corrected extraction outputs into `few_shot_library` and dynamically inject verified ground-truth samples into prompt contexts to improve extraction accuracy over time.

---

## 🚀 How to Run Locally

Built on **Full-Stack Express.js + Vite (React + TypeScript)** running on a single port (`3000`).

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev
```

App Dashboard and API Services will be accessible at:
👉 **http://localhost:3000**

---

## 🗄️ Supabase PostgreSQL Database Schema

Execute this SQL script in your Supabase SQL Editor to provision all tables:

```sql
-- 1. Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    document_type VARCHAR(100) DEFAULT 'ATM_RECEIPT',
    status VARCHAR(30) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Receipt Images Table
CREATE TABLE IF NOT EXISTS images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_filename TEXT,
    storage_path TEXT,
    image_width INTEGER,
    image_height INTEGER,
    file_size BIGINT,
    mime_type VARCHAR(100) DEFAULT 'image/png',
    upload_status VARCHAR(30) DEFAULT 'UPLOADED',
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. VLM Results Table
CREATE TABLE IF NOT EXISTS vlm_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID REFERENCES images(id) ON DELETE CASCADE,
    provider VARCHAR(50) DEFAULT 'NVIDIA_NEMOTRON',
    raw_response_text TEXT,
    extracted_json JSONB NOT NULL,
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Dynamic Labels Catalog Table
CREATE TABLE IF NOT EXISTS dynamic_labels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    label_key VARCHAR(150) NOT NULL,
    is_validated BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_project_label UNIQUE (project_id, label_key)
);

-- 5. Few Shot Learning Library Table
CREATE TABLE IF NOT EXISTS few_shot_library (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_type VARCHAR(100) DEFAULT 'ATM Cash Withdrawal',
    verified_json_output JSONB NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Document Categories (Phase 4)
CREATE TABLE IF NOT EXISTS document_categories_ocr (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Receipt Templates (Phase 4)
CREATE TABLE IF NOT EXISTS receipt_templates_ocr (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES document_categories_ocr(id) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    schema_rule TEXT NOT NULL,
    keywords TEXT[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Disable Row Level Security for rapid development
ALTER TABLE document_categories_ocr DISABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_templates_ocr DISABLE ROW LEVEL SECURITY;
```

---

## 📡 REST API & Scalar Open API Endpoints

- **`POST /api/v1/ocr/process`**: Execute Nemotron OCR v2 + Hybrid Llama 70B extraction on base64 images.
- **`GET /api/v1/templates/categories`**: List all bank / issuer categories.
- **`POST /api/v1/templates/categories`**: Create a new bank category.
- **`GET /api/v1/templates/receipt-templates`**: List all receipt templates and keywords rules.
- **`POST /api/v1/templates/receipt-templates`**: Register a new template schema rule.
- **`GET /api/v1/projects`**: Manage workspace projects.
- **`GET /api/docs`**: View interactive API documentation (Scalar UI).
