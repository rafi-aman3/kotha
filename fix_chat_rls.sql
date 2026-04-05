-- =============================================
-- MESSAGING FIX: Run this in Supabase SQL Editor
-- This drops ALL old chat policies and recreates them cleanly.
-- =============================================

-- Step 1: Drop ALL existing policies on chat tables
do $$ 
declare
  pol record;
begin
  -- Drop all policies on conversations
  for pol in select policyname from pg_policies where tablename = 'conversations' and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.conversations', pol.policyname);
  end loop;

  -- Drop all policies on conversation_participants  
  for pol in select policyname from pg_policies where tablename = 'conversation_participants' and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.conversation_participants', pol.policyname);
  end loop;

  -- Drop all policies on messages
  for pol in select policyname from pg_policies where tablename = 'messages' and schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.messages', pol.policyname);
  end loop;
end $$;

-- Step 2: Enable RLS (idempotent)
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Step 3: Create helper function (PLPGSQL, not SQL)
create or replace function public.get_my_contact_conversations()
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return query select conversation_id from conversation_participants where user_id = auth.uid();
end;
$$;

-- Step 4: Conversations policies
create policy "Users can view their conversations"
  on public.conversations for select
  using (
    created_by = auth.uid() or 
    id in (select public.get_my_contact_conversations())
  );

create policy "Users can insert conversations"
  on public.conversations for insert
  with check (created_by = auth.uid());

create policy "Participants can update conversation"
  on public.conversations for update
  using (
    created_by = auth.uid() or
    id in (select public.get_my_contact_conversations())
  );

-- Step 5: Participants policies
create policy "Users can view participants"
  on public.conversation_participants for select
  using (conversation_id in (select public.get_my_contact_conversations()));

create policy "Users can insert participant record"
  on public.conversation_participants for insert
  with check (true);

create policy "Users can update own participant record"
  on public.conversation_participants for update
  using (user_id = auth.uid());

-- Step 6: Messages policies
create policy "Users can view messages"
  on public.messages for select
  using (conversation_id in (select public.get_my_contact_conversations()));

create policy "Users can insert messages"
  on public.messages for insert
  with check (
    sender_id = auth.uid() and 
    conversation_id in (select public.get_my_contact_conversations())
  );

-- Step 7: Realtime publication
do $$ 
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    execute 'alter publication supabase_realtime add table messages;';
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and tablename = 'conversation_participants'
  ) then
    execute 'alter publication supabase_realtime add table conversation_participants;';
  end if;
exception
  when duplicate_object then null;
end $$;

-- Step 8: Verify — run this after the above to confirm it works
-- select * from public.get_my_contact_conversations();
