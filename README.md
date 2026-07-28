# Nanonets ATM Receipt VLM Extractor Platform

Vision-Language Model (VLM) Unsupervised Dynamic Key-Value Extractor for ATM Receipts powered by **NVIDIA Nemotron 30B VLM (`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`)** and Supabase.

---

## 🚀 How to Run locally

Built on **Full-Stack Express.js + Vite (React + TypeScript)**.

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev
```

App and REST API will be active at:
👉 **http://localhost:3000**

---

## 🤖 VLM API Integration (NVIDIA Nemotron 30B)

The application communicates directly with NVIDIA's Vision-Language Model endpoint:
- **Endpoint:** `https://integrate.api.nvidia.com/v1/chat/completions`
- **Model:** `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`
- **Authorization Header:** `Bearer <NVIDIA_API_KEY>`

---

## 🗄️ Supabase PostgreSQL Schema

Execute this SQL DDL script in your Supabase SQL Editor:

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

-- 3. VLM Results Table (Stores NVIDIA Nemotron 30B Unsupervised Extractions)
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_images_project_id ON images(project_id);
CREATE INDEX IF NOT EXISTS idx_vlm_results_image_id ON vlm_results(image_id);
CREATE INDEX IF NOT EXISTS idx_vlm_results_jsonb ON vlm_results USING GIN (extracted_json);
CREATE INDEX IF NOT EXISTS idx_dynamic_labels_project_key ON dynamic_labels(project_id, label_key);
```

---

## 🛠️ Key Capabilities

1. **Unsupervised VLM Extraction:** Extracts dynamic key-value pairs (`ATM_LOCATION`, `WITHDRAWAL_AMOUNT`, `CASSETTE_DISPENSED`, etc.) in one shot without requiring predefined bounding box coordinates.
2. **Dynamic Field Studio:** Interactive workspace allowing operators to edit both key names and values before saving.
3. **Supabase Auto-Sync:** Saves JSON extractions into `vlm_results` (`JSONB`) and registers discovered key names into `dynamic_labels`.
4. **REST API Endpoints:** `/api/vlm`, `/api/upload`, `/api/projects`, `/api/images`, `/api/metrics`.
