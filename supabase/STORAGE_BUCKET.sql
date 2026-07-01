-- ══════════════════════════════════════════════════════════════════════════════
-- Creates the Storage bucket used for agent knowledge-base uploads.
-- Run once in Supabase → SQL Editor. Without this, document upload fails with
-- "Bucket not found". (Buckets can't be created by normal table migrations.)
-- ══════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('knowledge-documents', 'knowledge-documents', false)
on conflict (id) do nothing;

-- Allow authenticated users to read/write objects in this private bucket.
-- (The app scopes paths per org/agent server-side.)
drop policy if exists "knowledge_docs_rw" on storage.objects;
create policy "knowledge_docs_rw" on storage.objects
  for all to authenticated
  using (bucket_id = 'knowledge-documents')
  with check (bucket_id = 'knowledge-documents');
