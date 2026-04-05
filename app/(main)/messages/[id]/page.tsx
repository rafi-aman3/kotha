import ChatBox from '@/components/chat/chat-box'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Force dynamic rendering - never cache this page
export const dynamic = 'force-dynamic'

export default async function ActiveChatPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { id: conversationId } = await params

  // console.log('[CHAT DEBUG] conversationId:', conversationId)
  // console.log('[CHAT DEBUG] user.id:', user.id)

  // First check: does this conversation exist at all? (bypass RLS with a count)
  const { data: convo, error } = await supabase
    .from('conversations')
    .select('*, conversation_participants(user_id, role, last_read_at, profiles(id, full_name, username, avatar_url, status_mode, last_seen))')
    .eq('id', conversationId)
    .single()

  // console.log('[CHAT DEBUG] convo result:', JSON.stringify(convo))
  // console.log('[CHAT DEBUG] error result:', JSON.stringify(error))

  if (!convo) {
    return (
      <div className="p-8 text-center text-red-500 flex flex-col gap-4">
        <h2 className="font-bold text-xl">Conversation Not Found</h2>
        <div className="max-w-lg mx-auto text-sm text-zinc-600 space-y-2 text-left bg-zinc-50 p-4 rounded-lg border">
          <p><strong>Conversation ID:</strong> <code>{conversationId}</code></p>
          <p><strong>Your User ID:</strong> <code>{user.id}</code></p>
          <p><strong>DB Error:</strong> <code>{error?.message || error?.code || 'No error returned — RLS silently blocked'}</code></p>
          <p><strong>Error Details:</strong> <code>{JSON.stringify(error)}</code></p>
        </div>
        <p className="text-xs text-zinc-400 mt-4">Check your terminal for [CHAT DEBUG] logs</p>
      </div>
    )
  }

  // Get initial batch of messages (latest 50)
  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(50)

  // Mark as read immediately on server load
  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)

  return (
    <ChatBox
      conversation={convo}
      initialMessages={messages?.reverse() || []}
      currentUserId={user.id}
    />
  )
}
