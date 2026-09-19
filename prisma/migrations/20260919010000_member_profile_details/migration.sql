ALTER TABLE "members"
ADD COLUMN "nickname" VARCHAR(40),
ADD COLUMN "phone_number" VARCHAR(32),
ADD COLUMN "about" VARCHAR(240);

DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    EXECUTE $sql$
      INSERT INTO storage.buckets (
        id,
        name,
        public,
        file_size_limit,
        allowed_mime_types
      )
      VALUES (
        'profile-images',
        'profile-images',
        true,
        5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp']
      )
      ON CONFLICT (id) DO UPDATE SET
        public = EXCLUDED.public,
        file_size_limit = EXCLUDED.file_size_limit,
        allowed_mime_types = EXCLUDED.allowed_mime_types
    $sql$;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'Prometheus profile images insert own'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "Prometheus profile images insert own"
        ON storage.objects
        FOR INSERT
        TO authenticated
        WITH CHECK (
          bucket_id = 'profile-images'
          AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
        )
      $policy$;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'Prometheus profile images delete own'
    ) THEN
      EXECUTE $policy$
        CREATE POLICY "Prometheus profile images delete own"
        ON storage.objects
        FOR DELETE
        TO authenticated
        USING (
          bucket_id = 'profile-images'
          AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
        )
      $policy$;
    END IF;
  END IF;
END
$$;
