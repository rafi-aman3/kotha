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
 * Sends a message. Supports text and media attachments.
 */
export async function sendMessage(
  conversationId: string, 
  content: string,
  fileData?: {
    message_type?: string
    file_url?: string
    file_name?: string
    file_size?: number
    file_mime_type?: string
    reply_to_id?: string
  }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }
  
  const messageType = fileData?.message_type || 'text'
  
  // For text messages, content is required. For media, content is optional caption.
  if (messageType === 'text' && (!content || content.trim() === '')) {
    return { error: 'Message cannot be empty' }
  }

  const insertData: any = {
    conversation_id: conversationId,
    sender_id: user.id,
    content: content?.trim() || null,
    message_type: messageType,
  }

  if (fileData?.file_url) insertData.file_url = fileData.file_url
  if (fileData?.file_name) insertData.file_name = fileData.file_name
  if (fileData?.file_size) insertData.file_size = fileData.file_size
  if (fileData?.file_mime_type) insertData.file_mime_type = fileData.file_mime_type
  if (fileData?.reply_to_id) insertData.reply_to_id = fileData.reply_to_id

  const { data: message, error } = await supabase
    .from('messages')
    .insert(insertData)
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

/**
 * Edit a sent message (own only).
 */
export async function editMessage(messageId: string, newContent: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('messages')
    .update({ content: newContent.trim(), edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('sender_id', user.id)

  if (error) return { error: error.message }
  return { success: true }
}

/**
 * Delete a message.
 * scope: 'me' = hide for current user only, 'everyone' = soft delete for all
 */
export async function deleteMessage(messageId: string, scope: 'me' | 'everyone') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  if (scope === 'everyone') {
    const { error } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString(), content: null })
      .eq('id', messageId)
      .eq('sender_id', user.id)
    if (error) return { error: error.message }
  } else {
    // Add current user ID to deleted_for array
    const { data: msg } = await supabase
      .from('messages')
      .select('deleted_for')
      .eq('id', messageId)
      .single()
    
    const currentArr = msg?.deleted_for || []
    if (!currentArr.includes(user.id)) {
      currentArr.push(user.id)
    }
    
    const { error } = await supabase
      .from('messages')
      .update({ deleted_for: currentArr })
      .eq('id', messageId)
    if (error) return { error: error.message }
  }

  return { success: true }
}

/**
 * React to a message with an emoji.
 */
export async function reactToMessage(messageId: string, emoji: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Toggle: if reaction exists, remove it; otherwise add it
  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .single()

  if (existing) {
    await supabase.from('message_reactions').delete().eq('id', existing.id)
    return { action: 'removed' }
  } else {
    const { error } = await supabase
      .from('message_reactions')
      .insert({ message_id: messageId, user_id: user.id, emoji })
    if (error) return { error: error.message }
    return { action: 'added' }
  }
}

/**
 * Pin / unpin a message.
 */
export async function togglePinMessage(messageId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: msg } = await supabase
    .from('messages')
    .select('is_pinned')
    .eq('id', messageId)
    .single()

  if (!msg) return { error: 'Message not found' }

  const { error } = await supabase
    .from('messages')
    .update({
      is_pinned: !msg.is_pinned,
      pinned_by: !msg.is_pinned ? user.id : null,
      pinned_at: !msg.is_pinned ? new Date().toISOString() : null
    })
    .eq('id', messageId)

  if (error) return { error: error.message }
  return { pinned: !msg.is_pinned }
}

/**
 * Bookmark / unbookmark a message.
 */
export async function toggleBookmark(messageId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: existing } = await supabase
    .from('message_bookmarks')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    await supabase.from('message_bookmarks').delete().eq('id', existing.id)
    return { bookmarked: false }
  } else {
    const { error } = await supabase
      .from('message_bookmarks')
      .insert({ message_id: messageId, user_id: user.id })
    if (error) return { error: error.message }
    return { bookmarked: true }
  }
}

/**
 * Forward a message to another conversation.
 */
export async function forwardMessage(messageId: string, targetConversationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: original } = await supabase
    .from('messages')
    .select('*')
    .eq('id', messageId)
    .single()

  if (!original) return { error: 'Message not found' }

  const { error } = await supabase
    .from('messages')
    .insert({
      conversation_id: targetConversationId,
      sender_id: user.id,
      content: original.content,
      message_type: original.message_type || 'text',
      file_url: original.file_url,
      file_name: original.file_name,
      file_size: original.file_size,
      file_mime_type: original.file_mime_type,
      forwarded_from_id: messageId
    })

  if (error) return { error: error.message }

  await supabase
    .from('conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', targetConversationId)

  return { success: true }
}
