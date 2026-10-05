-- ══════════════════════════════════════════════════════════════════════════════
-- Creates the Storage bucket used for agent knowledge-base uploads.
-- Run once in Supabase → SQL Editor. Without this, document upload fails with
-- "Bucket not found". (Buckets can't be created by normal table migrations.)
-- ══════════════════════════════════════════════════════════════════════════════

-- 20 MB cap (ElevenLabs knowledge-base limit): signed upload URLs do not
-- enforce a size themselves. File contents are validated server-side.
insert into storage.buckets (id, name, public, file_size_limit)
values ('knowledge-documents', 'knowledge-documents', false, 20971520)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

-- Authenticated users can only READ objects under their own org folder
-- (`<org_id>/<agent_id>/<file>`). Uploads use signed upload URLs created
-- server-side and deletes go through the API, so tenants get no INSERT/UPDATE/
-- DELETE here. Same policy as migration 010 (re-running is safe).
drop policy if exists "knowledge_docs_rw" on storage.objects;
drop policy if exists "knowledge_docs_owner" on storage.objects;
create policy "knowledge_docs_owner" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'knowledge-documents'
    and (storage.foldername(name))[1] in (select id::text from public.organizations where user_id = auth.uid())
  );
