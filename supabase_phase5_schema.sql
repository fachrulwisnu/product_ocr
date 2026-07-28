-- Phase 5 SQL Schema for Annotations & HITL Corrections
-- Run this script in the Supabase SQL Editor

-- Store the final approved/corrected data for an image
CREATE TABLE IF NOT EXISTS annotations_ocr (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id UUID REFERENCES images_ocr(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects_ocr(id) ON DELETE CASCADE,
    reviewer_id UUID,
    final_json_data JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'APPROVED', -- APPROVED, REJECTED
    review_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fallback check for images table if images_ocr was not created
CREATE TABLE IF NOT EXISTS annotations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_id VARCHAR(255) NOT NULL,
    project_id VARCHAR(255),
    reviewer_id VARCHAR(255),
    final_json_data JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'APPROVED',
    review_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DISABLE RLS (For rapid early development)
ALTER TABLE annotations_ocr DISABLE ROW LEVEL SECURITY;
ALTER TABLE annotations DISABLE ROW LEVEL SECURITY;
