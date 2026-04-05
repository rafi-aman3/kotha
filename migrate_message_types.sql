-- =============================================
-- MESSAGE TYPES MIGRATION
-- Run this in Supabase SQL Editor
-- Adds media columns to messages table + chat storage bucket
-- =============================================

-- Step 1: Add new columns to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS message_type text DEFAULT 'text'
  CHECK (message_type IN ('text', 'image', 'video', 'audio', 'file'));
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_name text;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_size bigint;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_mime_type text;

-- Step 2: Make content nullable (media messages may not have text)
ALTER TABLE public.messages ALTER COLUMN content DROP NOT NULL;

-- Step 3: Create chat-attachments storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Step 4: Storage policies for chat-attachments
DO $$ BEGIN
  DROP POLICY IF EXISTS "Chat attachments are publicly readable" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can upload chat attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own chat attachments" ON storage.objects;
END $$;

CREATE POLICY "Chat attachments are publicly readable" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-attachments');

CREATE POLICY "Authenticated users can upload chat attachments" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own chat attachments" ON storage.objects
  FOR DELETE USING (bucket_id = 'chat-attachments' AND auth.uid() = owner);
