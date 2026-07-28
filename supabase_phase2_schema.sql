-- Phase 2 SQL Schema for Supabase Image Management Pipeline
-- Run this script in the Supabase SQL Editor

-- Images table to track uploaded receipts and their metadata
CREATE TABLE IF NOT EXISTS images_ocr (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects_ocr(id) ON DELETE CASCADE,
    uploader_id UUID REFERENCES users(id) ON DELETE SET NULL,
    original_file_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL, -- Path in the Supabase 'receipt-images' bucket
    file_size_bytes BIGINT,
    mime_type VARCHAR(100),
    width INTEGER,
    height INTEGER,
    status VARCHAR(50) DEFAULT 'UPLOADED', -- UPLOADED, COMPRESSED, PROCESSING_OCR, DONE, ERROR
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DISABLE RLS (For rapid early development)
ALTER TABLE images_ocr DISABLE ROW LEVEL SECURITY;
