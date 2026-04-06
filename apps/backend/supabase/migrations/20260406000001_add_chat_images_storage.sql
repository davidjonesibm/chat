-- Chat images storage bucket for image messages
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- RLS policies for chat-images storage
create policy "chat_images_public_read"
  on storage.objects for select
  using (bucket_id = 'chat-images');

create policy "chat_images_insert_authenticated"
  on storage.objects for insert
  with check (
    bucket_id = 'chat-images'
    and auth.role() = 'authenticated'
  );

create policy "chat_images_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'chat-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
