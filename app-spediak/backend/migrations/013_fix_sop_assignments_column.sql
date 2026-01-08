-- Migration 013: Fix sop_assignments column name
-- The controller expects sop_document_id but the table has document_id

-- Rename document_id to sop_document_id if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sop_assignments' AND column_name = 'document_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'sop_assignments' AND column_name = 'sop_document_id'
  ) THEN
    ALTER TABLE sop_assignments RENAME COLUMN document_id TO sop_document_id;
    RAISE NOTICE 'Renamed document_id to sop_document_id';
  END IF;
END $$;

-- Remove "State Specific" from sop_organizations if it exists
DELETE FROM sop_organizations WHERE name = 'State Specific';
