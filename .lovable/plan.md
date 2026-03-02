

# Fix: Signature / Sello Digital Upload - RLS Policy Error

## Problem
When a doctor tries to upload a signature image, they get "new row violates row-level security policy". This happens because the `documents` storage bucket only has INSERT policies for paths starting with `chat/`, but the signature upload uses the path `signatures/{userId}/signature.{ext}`.

## Solution

### 1. Database Migration - Add Storage Policies for Signatures

Create a new migration that adds 4 RLS policies on `storage.objects` for the `signatures/` folder in the `documents` bucket:

- **INSERT**: Approved doctors can upload to `signatures/{their_user_id}/`
- **SELECT**: Doctors can view their own signatures
- **UPDATE**: Approved doctors can update (upsert) their own signatures
- **DELETE**: Approved doctors can delete their own signatures

Each policy checks:
- `bucket_id = 'documents'`
- `(storage.foldername(name))[1] = 'signatures'`
- `(storage.foldername(name))[2] = auth.uid()::text`
- For write operations: `public.is_approved_doctor(auth.uid())`

### 2. No Code Changes Needed

The `SignatureUpload.tsx` component code is correct -- it uploads to the right path (`signatures/{userId}/signature.{ext}`), creates a signed URL, and updates `doctor_profiles.signature_url`. The only issue is the missing storage policies.

## Technical Details

```sql
CREATE POLICY "Doctors can upload signatures"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_approved_doctor(auth.uid())
);

CREATE POLICY "Doctors can view own signatures"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

CREATE POLICY "Doctors can update own signatures"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_approved_doctor(auth.uid())
);

CREATE POLICY "Doctors can delete own signatures"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] = 'signatures'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_approved_doctor(auth.uid())
);
```

| File | Change |
|------|--------|
| `supabase/migrations/new_migration.sql` | Add 4 storage RLS policies for signatures folder |

