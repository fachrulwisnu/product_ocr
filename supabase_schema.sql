-- =========================================================================
-- ATM RECEIPT EXTRACTOR - VLM SUPABASE POSTGRESQL SCHEMA
-- Engine: NVIDIA Nemotron-3 Nano Omni 30B Reasoning VLM
-- =========================================================================

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

-- Create Indexes for High Performance JSONB & FK Queries
CREATE INDEX IF NOT EXISTS idx_images_project_id ON images(project_id);
CREATE INDEX IF NOT EXISTS idx_vlm_results_image_id ON vlm_results(image_id);
CREATE INDEX IF NOT EXISTS idx_vlm_results_jsonb ON vlm_results USING GIN (extracted_json);
CREATE INDEX IF NOT EXISTS idx_dynamic_labels_project_key ON dynamic_labels(project_id, label_key);

-- Sample Seed Data
INSERT INTO projects (name, description, document_type, status)
VALUES ('ATM Receipt Intelligence', 'Vision-Language Model extraction for multi-bank thermal ATM receipts', 'ATM_RECEIPT', 'ACTIVE')
ON CONFLICT DO NOTHING;
