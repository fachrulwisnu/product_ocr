-- Phase 4 SQL Schema for Document Categories & Receipt Templates
-- Run this script in the Supabase SQL Editor

-- 1. Document Categories (e.g., BCA, BRI, CIMB Niaga, Permata, First National Bank)
CREATE TABLE IF NOT EXISTS document_categories_ocr (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Receipt Templates (e.g., Cassette Audit, Withdrawal, Deposit)
CREATE TABLE IF NOT EXISTS receipt_templates_ocr (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES document_categories_ocr(id) ON DELETE CASCADE,
    template_name VARCHAR(255) NOT NULL,
    schema_rule TEXT NOT NULL, -- The exact JSON schema instruction for the LLM
    keywords TEXT[] NOT NULL, -- Array of keywords to trigger this template (e.g., '{"CIMB", "CASSETTE"}')
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- DISABLE RLS (For rapid early development)
ALTER TABLE document_categories_ocr DISABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_templates_ocr DISABLE ROW LEVEL SECURITY;
