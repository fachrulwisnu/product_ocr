-- Phase 3 SQL Schema for Supabase OCR Results & Bounding Boxes
-- Run this script in the Supabase SQL Editor

-- Store the overall OCR processing result for an image
CREATE TABLE IF NOT EXISTS ocr_results_ocr (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID REFERENCES images_ocr(id) ON DELETE CASCADE,
    raw_text TEXT, -- Combined full text from the receipt
    raw_json_response JSONB, -- The complete raw payload from NVIDIA API
    processing_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Store individual text blocks/lines and their bounding box coordinates
CREATE TABLE IF NOT EXISTS ocr_blocks_ocr (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ocr_result_id UUID REFERENCES ocr_results_ocr(id) ON DELETE CASCADE,
    text_content TEXT NOT NULL,
    confidence FLOAT,
    -- Bounding box coordinates (normalized percentages 0-100 or pixels)
    box_x FLOAT,
    box_y FLOAT,
    box_width FLOAT,
    box_height FLOAT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DISABLE RLS (For rapid early development)
ALTER TABLE ocr_results_ocr DISABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_blocks_ocr DISABLE ROW LEVEL SECURITY;
