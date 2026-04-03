-- Add cover_image column to projects table
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cover_image text;

-- Populate cover_image for all known projects using slug-based path
UPDATE projects
SET cover_image = 'work/' || slug || '-cover.jpg'
WHERE slug IN (
  'brewhaus',
  'burrell-group',
  'curl-co',
  'dj-mastamind',
  'safespace',
  'soulcheck',
  'squeeze-shop',
  'st-john',
  'tckt',
  'thrive-site'
)
AND (cover_image IS NULL OR cover_image = '');
