'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendMessage, markAsRead } from '@/lib/actions/chat'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Check, CheckCheck, SendHorizontal, Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { format } from 'date-fns'

export default function ChatBox({ conversation, initialMessages, currentUserId }: any) {
  const [messages, setMessages] = useState<any[]>(initialMessages || [])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({}) // tracks who is typing
  const [isSending, setIsSending] = useState(false)
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const supabase = createClient()
  const roomId = `room:${conversation.id}`

  // Derive conversation details
  const otherParticipants = conversation.conversation_participants
    .filter((p: any) => p.user_id !== currentUserId)
    
  let displayName = conversation.name
  let displayAvatarUrl = null
  let fallbackPrefix = 'G'
  let highestOtherReadAt = 0

  // Calculate highest read timestamp from others to determine blue ticks
  otherParticipants.forEach((p: any) => {
    if (p && p.last_read_at) {
      const ts = new Date(p.last_read_at).getTime()
      if (ts > highestOtherReadAt) highestOtherReadAt = ts
    }
  })

  if (conversation.type === 'direct' && otherParticipants.length > 0) {
    displayName = otherParticipants[0].profiles?.full_name || 'Unknown User'
    displayAvatarUrl = otherParticipants[0].profiles?.avatar_url
    fallbackPrefix = displayName.charAt(0).toUpperCase()
  } else if (!displayName) {
    displayName = otherParticipants.map((p: any) => p.profiles?.full_name || 'User').join(', ') || 'Group Chat'
  }

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, scrollToBottom])

  useEffect(() => {
    // Re-mark as read continuously if we are active
    markAsRead(conversation.id)

    // Setup Realtime Database Sync
    const messageSync = supabase
      .channel(`db-messages-${conversation.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new])
          // If we receive a message while looking at the screen, mark as read!
          markAsRead(conversation.id)
        }
      )
      .subscribe()

    // Setup Presence for Typing Indicators
    const presenceChannel = supabase.channel(roomId)
    
    presenceChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        setIsTyping(prev => ({ ...prev, [payload.payload.userId]: payload.payload.isTyping }))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(messageSync)
      supabase.removeChannel(presenceChannel)
    }
  }, [conversation.id])

  async function handleSend() {
    if (inputText.trim() === '' || isSending) return
    const content = inputText.trim()
    setInputText('') // optimistic clearing
    setIsSending(true)
    
    // Broadcast stop typing
    await supabase.channel(roomId).send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, isTyping: false }
    })

    await sendMessage(conversation.id, content)
    setIsSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleTyping(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (e.target.value.length > 2000) return // Character limit enforcement
    setInputText(e.target.value)

    // Broadcast typing event
    supabase.channel(roomId).send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUserId, isTyping: true }
    })

    // Auto-stop typing after 2 seconds
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      supabase.channel(roomId).send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, isTyping: false }
      })
    }, 2000)
  }

  // Which users are typing right now?
  const typingUserIds = Object.keys(isTyping).filter(id => isTyping[id])
  const typingNames = typingUserIds.map(id => {
    const cp = otherParticipants.find((p: any) => p.user_id === id)
    return cp ? (cp.profiles?.full_name || 'Someone') : 'Someone'
  })

  let typingText = ''
  if (typingNames.length === 1) typingText = `${typingNames[0]} is typing...`
  else if (typingNames.length > 1) typingText = `${typingNames.join(', ')} are typing...`

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-black/95 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b bg-white dark:bg-zinc-950/80 backdrop-blur z-10 shrink-0">
        <Avatar className="h-10 w-10 border">
          <AvatarImage src={displayAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${conversation.id}`} />
          <AvatarFallback>{fallbackPrefix}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col">
          <h3 className="font-semibold text-sm">{displayName}</h3>
          <span className="text-xs text-muted-foreground">
            {conversation.type === 'direct' && otherParticipants[0]?.profiles?.status_mode === 'online' ? (
              <span className="text-green-500 font-medium">Online</span>
            ) : conversation.type === 'direct' ? (
              <span>Offline</span>
            ) : (
              <span>Group • {conversation.conversation_participants.length} members</span>
            )}
          </span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full w-full p-4">
          <div className="flex flex-col gap-4 justify-end min-h-full pb-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground my-auto pt-20 text-sm">
                No messages yet. Say 👋 to start the conversation!
              </div>
            ) : (
            messages.map((msg: any, i: number) => {
              const isMe = msg.sender_id === currentUserId
              const msgTs = new Date(msg.created_at).getTime()
              const isRead = msgTs <= highestOtherReadAt
              
              // Simple check if previous message was from same sender to group bubbles visually
              const prevMsg = i > 0 ? messages[i-1] : null
              const isSameSenderAsPrev = prevMsg && prevMsg.sender_id === msg.sender_id

              return (
                 <div key={msg.id || i} className={`flex flex-col gap-1 w-fit max-w-[75%] ${isMe ? 'self-end' : 'self-start'} ${isSameSenderAsPrev ? 'mt-0' : 'mt-2'}`}>
                    <div className={`px-4 py-2 rounded-2xl text-[15px] leading-relaxed shadow-sm break-words
                      ${isMe ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-bl-sm'}
                    `}>
                       <span className="whitespace-pre-wrap">{msg.content}</span>
                       <div className={`flex items-center justify-end gap-1 mt-1 -mb-1 ${isMe ? 'text-indigo-200' : 'text-muted-foreground'}`}>
                         <span className="text-[10px]">{format(new Date(msg.created_at), 'hh:mm a')}</span>
                         {isMe && (
                           isRead ? <CheckCheck className="w-3 h-3 text-blue-300" /> : <Check className="w-3 h-3" />
                         )}
                       </div>
                    </div>
                 </div>
              )
            })
          )}
          {typingText && (
             <div className="self-start mt-2 px-4 py-2 bg-transparent text-muted-foreground text-xs animate-pulse flex items-center gap-1">
               <span className="flex gap-1">
                 <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                 <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                 <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
               </span>
               <span className="ml-2">{typingText}</span>
             </div>
            )}
            <div ref={scrollRef} className="h-1" />
          </div>
        </ScrollArea>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white dark:bg-zinc-950 border-t shrink-0">
        <div className="flex items-end gap-2 max-w-4xl mx-auto relative">
          <textarea
            value={inputText}
            onChange={handleTyping}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 max-h-32 min-h-[44px] w-full rounded-2xl border border-input bg-transparent px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 resize-none overflow-y-auto"
            rows={1}
            maxLength={2000}
          />
          <Button 
            onClick={handleSend} 
            disabled={!inputText.trim() || isSending}
            size="icon"
            className="rounded-full h-11 w-11 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-transform active:scale-95"
          >
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <SendHorizontal className="w-5 h-5 ml-0.5" />}
          </Button>
        </div>
        <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-2 max-w-4xl mx-auto px-1">
          <span><strong>Enter</strong> to send, <strong>Shift+Enter</strong> for newline</span>
          <span className={inputText.length >= 2000 ? 'text-red-500 font-medium' : ''}>{inputText.length}/2000</span>
        </div>
      </div>
    </div>
  )
}
