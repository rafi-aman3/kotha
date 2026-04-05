'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

/**
 * Ensures a direct message conversation exists between the current user and the target user.
 * Returns the conversation_id.
 */
export async function getOrCreateDirectChat(targetUserId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }
  if (user.id === targetUserId) return { error: 'Cannot chat with yourself' }

  // Check if direct conversation already exists.
  // Find all direct conversations for current user
  const { data: myConvos } = await supabase
    .from('conversation_participants')
    .select('conversation_id, conversations!inner(type)')
    .eq('user_id', user.id)
    .eq('conversations.type', 'direct')

  if (myConvos && myConvos.length > 0) {
    const convoIds = myConvos.map(c => c.conversation_id)
    
    // Check if targetUser is in any of these
    const { data: shared } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .in('conversation_id', convoIds)
      .eq('user_id', targetUserId)
      .limit(1)

    if (shared && shared.length > 0) {
      return { conversation_id: shared[0].conversation_id }
    }
  }

  // Create new conversation
  const { data: newConvo, error: createError } = await supabase
    .from('conversations')
    .insert({ type: 'direct', created_by: user.id })
    .select('id')
    .single()

  if (createError) return { error: createError.message }

  // Insert both participants
  const { error: partError } = await supabase
    .from('conversation_participants')
    .insert([
      { conversation_id: newConvo.id, user_id: user.id, role: 'admin' },
      { conversation_id: newConvo.id, user_id: targetUserId, role: 'member' }
    ])

  if (partError) return { error: partError.message }

  revalidatePath('/messages')
  return { conversation_id: newConvo.id }
}

/**
 * Creates a group chat.
 */
export async function createGroupChat(name: string, memberIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }
  if (!name || name.trim() === '') return { error: 'Group name required' }

  const { data: newConvo, error: createError } = await supabase
    .from('conversations')
    .insert({ type: 'group', name, created_by: user.id })
    .select('id')
    .single()

  if (createError) return { error: createError.message }

  // Distinct member ids including self
  const allMembers = Array.from(new Set([user.id, ...memberIds]))
  const participants = allMembers.map(id => ({
    conversation_id: newConvo.id,
    user_id: id,
    role: id === user.id ? 'admin' : 'member'
  }))

  const { error: partError } = await supabase
    .from('conversation_participants')
    .insert(participants)

  if (partError) return { error: partError.message }

  revalidatePath('/messages')
  return { conversation_id: newConvo.id }
}

/**
 * Sends a message.
 */
export async function sendMessage(conversationId: string, content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }
  if (!content || content.trim() === '') return { error: 'Message cannot be empty' }

  const { data: message, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: content.trim()
    })
    .select('*')
    .single()

  if (error) return { error: error.message }

  // Update conversation updated_at
  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId)

  return { message }
}

/**
 * Update the user's last read timestamp for a conversation.
 */
export async function markAsRead(conversationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
}

/**
 * Search users for new chats.
 * Shows public profiles + conversation partners (via RLS).
 * When no query, returns 5 suggested users.
 */
export async function searchUsers(query: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!query || query.trim() === '') {
    // Show 5 suggested users when search is empty
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .neq('id', user?.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) return { error: error.message }
    return { users: data || [] }
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url')
    .neq('id', user?.id)
    .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
    .limit(20)

  if (error) return { error: error.message }
  return { users: data || [] }
}
