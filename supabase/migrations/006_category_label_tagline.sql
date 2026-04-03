-- Add category_label column
ALTER TABLE projects ADD COLUMN IF NOT EXISTS category_label text;

-- Prepopulate category_label and tagline for all existing projects
UPDATE projects SET
  category_label = 'Branding · Visual System',
  tagline = 'A bold identity built for a brand that refuses to blend in.'
WHERE slug = 'brewhaus';

UPDATE projects SET
  category_label = 'Branding · Website',
  tagline = 'A modernized digital presence for a public engagement consultancy.'
WHERE slug = 'burrell-group';

UPDATE projects SET
  category_label = 'Branding · Visual System',
  tagline = 'A fresh, confident identity made to feel like self-care with personality.'
WHERE slug = 'curl-co';

UPDATE projects SET
  category_label = 'Branding · Social Media',
  tagline = 'A full brand overhaul built to match his energy and reach.'
WHERE slug = 'dj-mastamind';

UPDATE projects SET
  category_label = 'Branding · UX Design',
  tagline = 'A brand and digital experience as welcoming as the mission behind it.'
WHERE slug = 'safespace';

UPDATE projects SET
  category_label = 'UX Design · Digital',
  tagline = 'A platform built for connection and accountability from day one.'
WHERE slug = 'soulcheck';

UPDATE projects SET
  category_label = 'Branding · Visual System',
  tagline = 'Fresh, fun, and unforgettable — just like the product.'
WHERE slug = 'squeeze-shop';

UPDATE projects SET
  category_label = 'Website Design · Photography',
  tagline = 'A refined web presence for a brand that leads with elegance.'
WHERE slug = 'st-john';

UPDATE projects SET
  category_label = 'UX Design · Digital',
  tagline = 'Seamless UX for a platform built around experiences.'
WHERE slug = 'tckt';

UPDATE projects SET
  category_label = 'Website Design · Branding',
  tagline = 'Built by Thrive, for Thrive. Bold, eclectic, and built different.'
WHERE slug = 'thrive-site';
