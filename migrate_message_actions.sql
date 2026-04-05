-- =============================================
-- MESSAGE ACTIONS MIGRATION
-- Run this in Supabase SQL Editor
-- =============================================

-- Step 1: Add columns to messages table
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_for uuid[] DEFAULT '{}';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS forwarded_from_id uuid REFERENCES public.messages(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS pinned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS pinned_at timestamptz;

-- Step 2: Allow users to update their own messages (edit/delete)
DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
END $$;

CREATE POLICY "Users can update own messages"
  ON public.messages FOR UPDATE
  USING (sender_id = auth.uid());

-- Step 3: Create message_reactions table
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view reactions in their conversations" ON public.message_reactions;
  DROP POLICY IF EXISTS "Users can add reactions" ON public.message_reactions;
  DROP POLICY IF EXISTS "Users can remove own reactions" ON public.message_reactions;
END $$;

CREATE POLICY "Users can view reactions in their conversations"
  ON public.message_reactions FOR SELECT
  USING (
    message_id IN (
      SELECT m.id FROM messages m
      WHERE m.conversation_id IN (SELECT public.get_my_contact_conversations())
    )
  );

CREATE POLICY "Users can add reactions"
  ON public.message_reactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove own reactions"
  ON public.message_reactions FOR DELETE
  USING (user_id = auth.uid());

-- Step 4: Create message_bookmarks table
CREATE TABLE IF NOT EXISTS public.message_bookmarks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(message_id, user_id)
);

ALTER TABLE public.message_bookmarks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own bookmarks" ON public.message_bookmarks;
  DROP POLICY IF EXISTS "Users can add bookmarks" ON public.message_bookmarks;
  DROP POLICY IF EXISTS "Users can remove own bookmarks" ON public.message_bookmarks;
END $$;

CREATE POLICY "Users can view own bookmarks"
  ON public.message_bookmarks FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can add bookmarks"
  ON public.message_bookmarks FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove own bookmarks"
  ON public.message_bookmarks FOR DELETE
  USING (user_id = auth.uid());

-- Step 5: Add realtime for reactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'message_reactions'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;';
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
