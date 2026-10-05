-- ══════════════════════════════════════════════════════════════════════════════
-- Creates the Storage bucket used for agent knowledge-base uploads.
-- Run once in Supabase → SQL Editor. Without this, document upload fails with
-- "Bucket not found". (Buckets can't be created by normal table migrations.)
-- ══════════════════════════════════════════════════════════════════════════════

insert into storage.buckets (id, name, public)
values ('knowledge-documents', 'knowledge-documents', false)
on conflict (id) do nothing;

-- Authenticated users can only read/write objects under their own org folder
-- (`<org_id>/<agent_id>/<file>`); the app uploads through signed upload URLs
-- created server-side. Same policy as migration 010 (re-running is safe).
drop policy if exists "knowledge_docs_rw" on storage.objects;
drop policy if exists "knowledge_docs_owner" on storage.objects;
create policy "knowledge_docs_owner" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'knowledge-documents'
    and (storage.foldername(name))[1] in (select id::text from public.organizations where user_id = auth.uid())
  )
  with check (
    bucket_id = 'knowledge-documents'
    and (storage.foldername(name))[1] in (select id::text from public.organizations where user_id = auth.uid())
  );
