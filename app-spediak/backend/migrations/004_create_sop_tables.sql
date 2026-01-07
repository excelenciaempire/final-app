-- Migration 004: SOP Management System
-- Created: 2026-01-04
-- Purpose: Add SOP document management with state and organization assignments

-- SOP Documents storage
CREATE TABLE IF NOT EXISTS sop_documents (
  id SERIAL PRIMARY KEY,
  document_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  document_type VARCHAR(20) NOT NULL CHECK (document_type IN ('state', 'organization')),
  uploaded_by VARCHAR(255) NOT NULL,
  version VARCHAR(50),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SOP State Assignments
CREATE TABLE IF NOT EXISTS sop_state_assignments (
  id SERIAL PRIMARY KEY,
  sop_document_id INTEGER NOT NULL,
  state_code VARCHAR(2) NOT NULL,
  assigned_by VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  effective_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_sop_state_document FOREIGN KEY (sop_document_id) 
    REFERENCES sop_documents(id) ON DELETE CASCADE,
  CONSTRAINT unique_state_sop UNIQUE (state_code, sop_document_id)
);

-- SOP Organization Assignments
CREATE TABLE IF NOT EXISTS sop_org_assignments (
  id SERIAL PRIMARY KEY,
  sop_document_id INTEGER NOT NULL,
  organization_name VARCHAR(50) NOT NULL,
  assigned_by VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  effective_date TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_sop_org_document FOREIGN KEY (sop_document_id) 
    REFERENCES sop_documents(id) ON DELETE CASCADE,
  CONSTRAINT unique_org_sop UNIQUE (organization_name, sop_document_id)
);

-- SOP Change History (audit log)
CREATE TABLE IF NOT EXISTS sop_history (
  id SERIAL PRIMARY KEY,
  sop_document_id INTEGER,
  action_type VARCHAR(50) NOT NULL,
  action_by VARCHAR(255) NOT NULL,
  action_details JSONB,
  previous_state JSONB,
  new_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sop_documents_type ON sop_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_sop_documents_active ON sop_documents(is_active);
CREATE INDEX IF NOT EXISTS idx_sop_state_assignments_state ON sop_state_assignments(state_code);
CREATE INDEX IF NOT EXISTS idx_sop_state_assignments_active ON sop_state_assignments(is_active);
CREATE INDEX IF NOT EXISTS idx_sop_org_assignments_org ON sop_org_assignments(organization_name);
CREATE INDEX IF NOT EXISTS idx_sop_org_assignments_active ON sop_org_assignments(is_active);
CREATE INDEX IF NOT EXISTS idx_sop_history_document_id ON sop_history(sop_document_id);
CREATE INDEX IF NOT EXISTS idx_sop_history_created_at ON sop_history(created_at DESC);

-- Create update triggers
CREATE TRIGGER update_sop_documents_updated_at
BEFORE UPDATE ON sop_documents
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_sop_state_assignments_updated_at
BEFORE UPDATE ON sop_state_assignments
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_sop_org_assignments_updated_at
BEFORE UPDATE ON sop_org_assignments
FOR EACH ROW
EXECUTE PROCEDURE update_updated_at_column();

-- Add helpful comments
COMMENT ON TABLE sop_documents IS 'Standard Operating Procedure documents';
COMMENT ON TABLE sop_state_assignments IS 'SOP assignments per US state';
COMMENT ON TABLE sop_org_assignments IS 'SOP assignments per organization (ASHI, InterNACHI)';
COMMENT ON TABLE sop_history IS 'Immutable audit log of all SOP changes';

