-- Standardize bilingual naming for core tables

-- 1. fiscal_periods
ALTER TABLE fiscal_periods RENAME COLUMN name TO name_th;
ALTER TABLE fiscal_periods ADD COLUMN name_en VARCHAR(50);
UPDATE fiscal_periods SET name_en = name_th WHERE name_en IS NULL;

-- 2. repack_templates
ALTER TABLE repack_templates RENAME COLUMN name TO name_th;
ALTER TABLE repack_templates ADD COLUMN name_en VARCHAR(255);
UPDATE repack_templates SET name_en = name_th WHERE name_en IS NULL;
