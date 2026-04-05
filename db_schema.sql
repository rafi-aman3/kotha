-- Create a table for public profiles if it doesn't already exist
create table if not exists profiles (
  id uuid references auth.users not null primary key,
  username text unique,
  full_name text,
  avatar_url text,
  bio text,
  status_message text,
  status_mode text check (status_mode in ('online', 'offline', 'away')),
  last_seen timestamp with time zone,
  is_public boolean default true,
  is_onboarded boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table profiles enable row level security;

-- Drop existing policies to prevent "policy already exists" errors on rerun
do $$ begin
  drop policy if exists "Public profiles are viewable by everyone." on profiles;
  drop policy if exists "Users can view their own profile." on profiles;
  drop policy if exists "Users can view conversation partner profiles." on profiles;
  drop policy if exists "Users can insert their own profile." on profiles;
  drop policy if exists "Users can update own profile." on profiles;
  drop policy if exists "Users can delete own profile." on profiles;
end $$;

create policy "Public profiles are viewable by everyone." on profiles
  for select using (is_public = true);

create policy "Users can view their own profile." on profiles
  for select using (auth.uid() = id);

-- Helper: get user IDs of people I share a conversation with
create or replace function public.get_my_conversation_members()
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select distinct cp2.user_id
    from conversation_participants cp1
    join conversation_participants cp2 on cp1.conversation_id = cp2.conversation_id
    where cp1.user_id = auth.uid() and cp2.user_id != auth.uid();
end;
$$;

-- Chat partners can see each other's profile even if private
create policy "Users can view conversation partner profiles." on profiles
  for select using (id in (select public.get_my_conversation_members()));

create policy "Users can insert their own profile." on profiles
  for insert with check (auth.uid() = id);

create policy "Users can update own profile." on profiles
  for update using (auth.uid() = id);

create policy "Users can delete own profile." on profiles
  for delete using (auth.uid() = id);

-- Set up Storage for avatars (ignore error if it already exists)
insert into storage.buckets (id, name, public) 
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

do $$ begin
  drop policy if exists "Avatar images are publicly accessible." on storage.objects;
  drop policy if exists "Anyone can upload an avatar." on storage.objects;
  drop policy if exists "Anyone can update their own avatar." on storage.objects;
  drop policy if exists "Anyone can delete their own avatar." on storage.objects;
end $$;

create policy "Avatar images are publicly accessible." on storage.objects
  for select using (bucket_id = 'avatars');

create policy "Anyone can upload an avatar." on storage.objects
  for insert with check (bucket_id = 'avatars');

create policy "Anyone can update their own avatar." on storage.objects
  for update using (auth.uid() = owner);

create policy "Anyone can delete their own avatar." on storage.objects
  for delete using (auth.uid() = owner);

-- Function for handle_new_user
create or replace function public.handle_new_user()
returns trigger as $$
declare
  generated_username text;
begin
  -- Generate a random username: user_ + random string
  generated_username := 'user_' || substr(md5(random()::text), 1, 8);
  
  insert into public.profiles (id, full_name, username, avatar_url, status_mode, is_public, is_onboarded)
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    generated_username,
    'https://api.dicebear.com/7.x/bottts/svg?seed=' || new.id,
    'offline',
    true,
    false
  )
  on conflict (id) do nothing;
  
  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Drop and recreate trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Set up realtime for profiles to allow subscribing to presence/status changes
-- Ignore if publication already exists setup
do $$ begin
  execute 'alter publication supabase_realtime add table profiles;';
exception
  when duplicate_object then null;
end $$;

-- Function to allow a user to delete their own account
create or replace function public.delete_user()
returns void as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$ language plpgsql security definer;

-- Create conversations table
create table if not exists public.conversations (
  id uuid default gen_random_uuid() primary key,
  type text not null check (type in ('direct', 'group')),
  name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create conversation_participants table
create table if not exists public.conversation_participants (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('admin', 'member')),
  last_read_at timestamp with time zone default '1970-01-01 00:00:00+00',
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (conversation_id, user_id)
);

-- Create messages table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  sender_id uuid references public.profiles(id) on delete set null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS on new tables
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

-- Drop any existing buggy policies to allow clean recreation
do $$ begin
  drop policy if exists "Users can view their conversations" on public.conversations;
  drop policy if exists "Participants can update conversation" on public.conversations;
  drop policy if exists "Users can insert conversations" on public.conversations;
  
  drop policy if exists "Users can view participants of their conversations" on public.conversation_participants;
  drop policy if exists "Users can view participants" on public.conversation_participants;
  drop policy if exists "Users can update their own participant record" on public.conversation_participants;
  drop policy if exists "Users can update own participant record" on public.conversation_participants;
  drop policy if exists "Users can insert participant record" on public.conversation_participants;
  
  drop policy if exists "Users can view messages in their conversations" on public.messages;
  drop policy if exists "Users can view messages" on public.messages;
  drop policy if exists "Users can insert messages in their conversations" on public.messages;
  drop policy if exists "Users can insert messages" on public.messages;
end $$;

-- Create helper function to break recursion
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

-- Conversations RLS
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
  using (id in (select public.get_my_contact_conversations()));

-- Participants RLS
create policy "Users can view participants"
  on public.conversation_participants for select
  using (conversation_id in (select public.get_my_contact_conversations()));

create policy "Users can insert participant record"
  on public.conversation_participants for insert
  with check (true); -- Allow insertion for new chats (secured by application code restrictions)

create policy "Users can update own participant record"
  on public.conversation_participants for update
  using (user_id = auth.uid());

-- Messages RLS
create policy "Users can view messages"
  on public.messages for select
  using (conversation_id in (select public.get_my_contact_conversations()));

create policy "Users can insert messages"
  on public.messages for insert
  with check (
    sender_id = auth.uid() and 
    conversation_id in (select public.get_my_contact_conversations())
  );

-- Configure Publication for realtime on messages and participants
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
