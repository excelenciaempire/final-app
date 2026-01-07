-- Migration 007: Create unified sop_assignments table
-- Created: 2026-01-07
-- Purpose: Create the sop_assignments table expected by the controller

-- Create unified sop_assignments table
CREATE TABLE IF NOT EXISTS sop_assignments (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL,
  assignment_type VARCHAR(20) NOT NULL CHECK (assignment_type IN ('state', 'organization')),
  assignment_value VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT fk_sop_assignment_document FOREIGN KEY (document_id) 
    REFERENCES sop_documents(id) ON DELETE CASCADE,
  CONSTRAINT unique_assignment UNIQUE (assignment_type, assignment_value)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sop_assignments_type ON sop_assignments(assignment_type);
CREATE INDEX IF NOT EXISTS idx_sop_assignments_value ON sop_assignments(assignment_value);
CREATE INDEX IF NOT EXISTS idx_sop_assignments_document ON sop_assignments(document_id);

-- Create update trigger for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_sop_assignments_updated_at') THEN
    CREATE TRIGGER update_sop_assignments_updated_at
    BEFORE UPDATE ON sop_assignments
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
  END IF;
END $$;

-- Also update sop_history table to have the columns expected by the controller
ALTER TABLE sop_history 
  ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS assignment_value VARCHAR(100),
  ADD COLUMN IF NOT EXISTS changed_by VARCHAR(255),
  ADD COLUMN IF NOT EXISTS change_details JSONB;

-- Create index for sop_history
CREATE INDEX IF NOT EXISTS idx_sop_history_assignment_type ON sop_history(assignment_type);

COMMENT ON TABLE sop_assignments IS 'Unified SOP assignments for states and organizations';

