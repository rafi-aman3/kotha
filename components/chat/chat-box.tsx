'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendMessage, markAsRead } from '@/lib/actions/chat'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { SendHorizontal, Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import MessageBubble from './message-bubble'
import { EmojiPicker } from './emoji-picker'
import { MediaUploadButton } from './media-upload-button'
import { VoiceRecorder } from './voice-recorder'
import { ReplyPreview } from './reply-preview'
import { ForwardDialog } from './forward-dialog'

export default function ChatBox({ conversation, initialMessages, currentUserId }: any) {
  const [messages, setMessages] = useState<any[]>(initialMessages || [])
  const [inputText, setInputText] = useState('')
  const [isTyping, setIsTyping] = useState<Record<string, boolean>>({})
  const [isSending, setIsSending] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(initialMessages?.length >= 50)
  const [replyingTo, setReplyingTo] = useState<any>(null)
  const [forwardMsg, setForwardMsg] = useState<any>(null)
  const [reactions, setReactions] = useState<Record<string, any[]>>({})
  
  const scrollRef = useRef<HTMLDivElement>(null)
  const topSentinelRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const supabase = createClient()
  const roomId = `room:${conversation.id}`

  const otherParticipants = conversation.conversation_participants
    .filter((p: any) => p.user_id !== currentUserId)
    
  let displayName = conversation.name
  let displayAvatarUrl = null
  let fallbackPrefix = 'G'
  let highestOtherReadAt = 0
  const isGroup = conversation.type === 'group'

  const profileMap: Record<string, any> = {}
  conversation.conversation_participants.forEach((p: any) => {
    if (p.profiles) profileMap[p.user_id] = p.profiles
  })

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

  useEffect(() => { scrollToBottom() }, [messages, isTyping, scrollToBottom])

  // Fetch reactions for visible messages
  async function fetchReactions() {
    const msgIds = messages.map(m => m.id).filter(Boolean)
    if (msgIds.length === 0) return

    const { data } = await supabase
      .from('message_reactions')
      .select('*')
      .in('message_id', msgIds)

    if (data) {
      const grouped: Record<string, any[]> = {}
      data.forEach((r: any) => {
        if (!grouped[r.message_id]) grouped[r.message_id] = []
        grouped[r.message_id].push(r)
      })
      setReactions(grouped)
    }
  }

  useEffect(() => { fetchReactions() }, [messages])

  useEffect(() => {
    markAsRead(conversation.id)

    const messageSync = supabase
      .channel(`db-messages-${conversation.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [...prev, payload.new])
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m))
          }
          markAsRead(conversation.id)
        }
      )
      .subscribe()

    // Also listen for reaction changes
    const reactionSync = supabase
      .channel(`db-reactions-${conversation.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'message_reactions' },
        () => { fetchReactions() }
      )
      .subscribe()

    const presenceChannel = supabase.channel(roomId)
    presenceChannel
      .on('broadcast', { event: 'typing' }, (payload) => {
        setIsTyping(prev => ({ ...prev, [payload.payload.userId]: payload.payload.isTyping }))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(messageSync)
      supabase.removeChannel(reactionSync)
      supabase.removeChannel(presenceChannel)
    }
  }, [conversation.id])

  // Infinite scroll
  useEffect(() => {
    if (!topSentinelRef.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingOlder) loadOlderMessages()
      },
      { threshold: 0.1 }
    )
    observer.observe(topSentinelRef.current)
    return () => observer.disconnect()
  }, [hasMore, loadingOlder, messages])

  async function loadOlderMessages() {
    if (messages.length === 0 || loadingOlder) return
    setLoadingOlder(true)
    const oldestMessage = messages[0]
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .lt('created_at', oldestMessage.created_at)
      .order('created_at', { ascending: false })
      .limit(50)

    if (data && data.length > 0) {
      setMessages(prev => [...data.reverse(), ...prev])
      if (data.length < 50) setHasMore(false)
    } else { setHasMore(false) }
    setLoadingOlder(false)
  }

  async function handleSend() {
    if (inputText.trim() === '' || isSending) return
    const content = inputText.trim()
    setInputText('')
    setIsSending(true)
    
    await supabase.channel(roomId).send({
      type: 'broadcast', event: 'typing',
      payload: { userId: currentUserId, isTyping: false }
    })

    await sendMessage(conversation.id, content, replyingTo ? { message_type: 'text', reply_to_id: replyingTo.id } : undefined)
    setReplyingTo(null)
    setIsSending(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleTyping(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (e.target.value.length > 2000) return
    setInputText(e.target.value)
    supabase.channel(roomId).send({ type: 'broadcast', event: 'typing', payload: { userId: currentUserId, isTyping: true } })
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      supabase.channel(roomId).send({ type: 'broadcast', event: 'typing', payload: { userId: currentUserId, isTyping: false } })
    }, 2000)
  }

  function handleEmojiSelect(emoji: string) {
    setInputText(prev => prev + emoji)
    textareaRef.current?.focus()
  }

  function handleJumpToMessage(msgId: string) {
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('ring-2', 'ring-indigo-400', 'rounded-2xl')
      setTimeout(() => el.classList.remove('ring-2', 'ring-indigo-400', 'rounded-2xl'), 2000)
    }
  }

  function handleRefreshMessages() {
    // Refetch latest messages from DB
    supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversation.id)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (data) setMessages(data.reverse())
      })
  }

  // Build a map of reply targets
  const replyMap: Record<string, any> = {}
  messages.forEach(m => { replyMap[m.id] = m })

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
          <div className="flex flex-col gap-1 justify-end min-h-full pb-4">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground my-auto pt-20 text-sm">
                No messages yet. Say 👋 to start the conversation!
              </div>
            ) : (
              <>
                <div ref={topSentinelRef} className="h-1" />
                {loadingOlder && (
                  <div className="text-center py-3">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
                  </div>
                )}
                {messages.map((msg: any, i: number) => {
                  const isMe = msg.sender_id === currentUserId
                  const msgTs = new Date(msg.created_at).getTime()
                  const isRead = msgTs <= highestOtherReadAt
                  const prevMsg = i > 0 ? messages[i-1] : null
                  const isSameSenderAsPrev = prevMsg && prevMsg.sender_id === msg.sender_id

                  return (
                    <MessageBubble
                      key={msg.id || i}
                      msg={msg}
                      isMe={isMe}
                      isRead={isRead}
                      isSameSenderAsPrev={!!isSameSenderAsPrev}
                      senderProfile={profileMap[msg.sender_id]}
                      isGroup={isGroup}
                      currentUserId={currentUserId}
                      reactions={reactions[msg.id] || []}
                      replyToMsg={msg.reply_to_id ? replyMap[msg.reply_to_id] : null}
                      onReply={(m) => { setReplyingTo(m); textareaRef.current?.focus() }}
                      onForward={(m) => setForwardMsg(m)}
                      onJumpToMessage={handleJumpToMessage}
                      onRefresh={handleRefreshMessages}
                    />
                  )
                })}
              </>
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

      {/* Reply preview */}
      {replyingTo && <ReplyPreview replyingTo={replyingTo} onCancel={() => setReplyingTo(null)} />}

      {/* Input Area */}
      <div className="p-3 bg-white dark:bg-zinc-950 border-t shrink-0">
        <div className="flex items-end gap-1.5 max-w-4xl mx-auto">
          <EmojiPicker onSelect={handleEmojiSelect} />
          <MediaUploadButton conversationId={conversation.id} />
          <VoiceRecorder conversationId={conversation.id} />
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleTyping}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 max-h-32 min-h-[44px] w-full rounded-2xl border border-input bg-transparent px-4 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 resize-none overflow-y-auto"
            rows={1}
            maxLength={2000}
          />
          <Button onClick={handleSend} disabled={!inputText.trim() || isSending} size="icon"
            className="rounded-full h-11 w-11 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-transform active:scale-95">
            {isSending ? <Loader2 className="w-5 h-5 animate-spin" /> : <SendHorizontal className="w-5 h-5 ml-0.5" />}
          </Button>
        </div>
        <div className="flex justify-between items-center text-[10px] text-muted-foreground mt-1.5 max-w-4xl mx-auto px-1">
          <span><strong>Enter</strong> to send, <strong>Shift+Enter</strong> for newline</span>
          <span className={inputText.length >= 2000 ? 'text-red-500 font-medium' : ''}>{inputText.length}/2000</span>
        </div>
      </div>

      {/* Forward dialog */}
      <ForwardDialog
        open={!!forwardMsg}
        onOpenChange={(open) => { if (!open) setForwardMsg(null) }}
        messageId={forwardMsg?.id || ''}
        currentUserId={currentUserId}
      />
    </div>
  )
}
