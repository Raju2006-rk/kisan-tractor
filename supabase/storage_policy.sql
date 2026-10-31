-- ==============================================================================
-- SUPABASE STORAGE BUCKET & ROW LEVEL SECURITY (RLS) POLICIES
-- Bucket ID: app-files
-- Use Case: Tractor photos, user profiles, driving licenses, RC, and payment QRs
-- ==============================================================================

-- 1. Create the storage bucket 'app-files' (Public bucket so images can be displayed)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-files',
  'app-files',
  true,
  10485760, -- 10 MB max file size limit for camera and high-res photos
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

-- 2. Enable Row Level Security (RLS) on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Clean up any existing policies for app-files to prevent duplicate errors
DROP POLICY IF EXISTS "Public can view files in app-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads to app-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow updates to app-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow deletes to app-files" ON storage.objects;

-- ==============================================================================
-- 4. STORAGE ACCESS POLICIES
-- ==============================================================================

-- POLICY 1: VIEW / READ (Public)
-- Anyone can view images (tractors, profile photos, QR codes) stored in 'app-files'
CREATE POLICY "Public can view files in app-files"
ON storage.objects
FOR SELECT
USING (bucket_id = 'app-files');

-- POLICY 2: UPLOAD / INSERT
-- Allows authenticated users as well as the app client to upload files to 'app-files'
CREATE POLICY "Allow uploads to app-files"
ON storage.objects
FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'app-files');

-- POLICY 3: UPDATE / OVERWRITE
-- Allows users to update/replace existing files in 'app-files'
CREATE POLICY "Allow updates to app-files"
ON storage.objects
FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'app-files')
WITH CHECK (bucket_id = 'app-files');

-- POLICY 4: DELETE / REMOVE
-- Allows users to delete files in 'app-files'
CREATE POLICY "Allow deletes to app-files"
ON storage.objects
FOR DELETE
TO anon, authenticated
USING (bucket_id = 'app-files');

