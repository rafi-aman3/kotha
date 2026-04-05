'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ExploreDialog } from './explore-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Users } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function ChatSidebar({ initialUserId }: { initialUserId: string }) {
  const [conversations, setConversations] = useState<any[]>([])
  const params = useParams()
  const activeId = params.id as string
  const supabase = createClient()

  useEffect(() => {
    fetchConversations()

    // Subscribe to new messages dropping in any active conversation!
    // Since Realtime RLS broadcasts strictly based on token, the backend will only send us payloads matching our Participant status!
    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        // We received a message. Fetch the latest convos to reorder and get the snippet.
        fetchConversations()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function fetchConversations() {
    // To get conversations + last message, we can query conversation_participants
    // and join with conversations, then messages
    const { data } = await supabase
      .from('conversation_participants')
      .select(`
        conversation_id,
        role,
        conversations:conversation_id (
          id, type, name, updated_at,
          conversation_participants (
            user_id,
            profiles (id, full_name, username, avatar_url)
          ),
          messages (
            content, created_at, sender_id
          )
        )
      `)
      .eq('user_id', initialUserId)
      .order('updated_at', { referencedTable: 'conversations', ascending: false })

    if (data) {
      // Process data to easily render
      const processed = data.map((cp: any) => {
        const convo = cp.conversations
        if (!convo) return null
        
        // Find other participants to generate auto-name for direct chats
        const otherParticipants = convo.conversation_participants
          .filter((p: any) => p.user_id !== initialUserId)
          .map((p: any) => p.profiles)
        
        let displayName = convo.name
        let displayAvatarUrl = null
        let fallbackPrefix = 'G'

        if (convo.type === 'direct' && otherParticipants.length > 0 && otherParticipants[0]) {
          displayName = otherParticipants[0].full_name || 'Unknown User'
          displayAvatarUrl = otherParticipants[0].avatar_url
          fallbackPrefix = displayName.charAt(0).toUpperCase()
        } else if (!displayName) {
          displayName = otherParticipants.filter(Boolean).map((p: any) => p.full_name).join(', ') || 'Group Chat'
        }

        // Get snippet from latest message
        const sortedMessages = [...convo.messages].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        const lastMessageSnippet = sortedMessages.length > 0 ? sortedMessages[0].content : 'No messages yet.'
        const lastMessageTime = sortedMessages.length > 0 ? sortedMessages[0].created_at : convo.updated_at

        return {
          id: convo.id,
          type: convo.type,
          displayName,
          displayAvatarUrl,
          fallbackPrefix,
          lastMessageSnippet,
          lastMessageTime
        }
      }).filter(Boolean)

      // Sort by latest message time
      const finalProcessed = processed.filter((item): item is NonNullable<typeof item> => item !== null)
      finalProcessed.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime())

      setConversations(finalProcessed)
    }
  }

  return (
    <div className="w-full md:w-80 border-r bg-card flex flex-col h-full bg-white dark:bg-black">
      <div className="p-4 border-b">
        <ExploreDialog />
      </div>
      
      <ScrollArea className="flex-1">
        <div className="flex flex-col">
          {conversations.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">
              No conversations. Discover connections!
            </div>
          )}
          {conversations.map((chat) => (
            <Link 
              key={chat.id} 
              href={`/messages/${chat.id}`}
              className={`flex items-center gap-3 p-4 border-b hover:bg-muted/50 cursor-pointer transition-colors ${activeId === chat.id ? 'bg-indigo-50 dark:bg-indigo-950/20' : ''}`}
            >
              <Avatar className="h-12 w-12 border shadow-sm">
                {chat.type === 'group' && !chat.displayAvatarUrl ? (
                  <div className="w-full h-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                ) : (
                  <>
                    <AvatarImage src={chat.displayAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${chat.id}`} />
                    <AvatarFallback>{chat.fallbackPrefix}</AvatarFallback>
                  </>
                )}
              </Avatar>
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold truncate text-sm">{chat.displayName}</span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                    {formatDistanceToNow(new Date(chat.lastMessageTime), { addSuffix: true }).replace('about ', '')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{chat.lastMessageSnippet}</p>
              </div>
            </Link>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
