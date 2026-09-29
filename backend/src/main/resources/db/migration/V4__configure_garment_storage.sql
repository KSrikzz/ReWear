INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'garment-photos',
    'garment-photos',
    true,
    12582912,
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view garment photos" ON storage.objects;
DROP POLICY IF EXISTS "Users upload only to their own garment folder" ON storage.objects;
DROP POLICY IF EXISTS "Users update only their own garment photos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete only their own garment photos" ON storage.objects;

CREATE POLICY "Public can view garment photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'garment-photos');

CREATE POLICY "Users upload only to their own garment folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'garment-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users update only their own garment photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'garment-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'garment-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users delete only their own garment photos"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'garment-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
);
