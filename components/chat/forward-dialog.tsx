'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { forwardMessage } from '@/lib/actions/chat'
import { toast } from 'sonner'

interface ForwardDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  messageId: string
  currentUserId: string
}

export function ForwardDialog({ open, onOpenChange, messageId, currentUserId }: ForwardDialogProps) {
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [forwarding, setForwarding] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (open) loadConversations()
  }, [open])

  async function loadConversations() {
    setLoading(true)
    const { data } = await supabase
      .from('conversation_participants')
      .select('conversation_id, conversations(id, name, type), profiles:user_id(id, full_name, avatar_url)')
      .eq('user_id', currentUserId)

    if (data) {
      // Group by conversation and pick display info
      const convoMap = new Map<string, any>()
      data.forEach((row: any) => {
        if (!convoMap.has(row.conversation_id)) {
          convoMap.set(row.conversation_id, {
            id: row.conversation_id,
            name: row.conversations?.name,
            type: row.conversations?.type,
            participants: []
          })
        }
      })

      // Get all participants per convo for display name
      for (const [convoId, convo] of convoMap) {
        const { data: parts } = await supabase
          .from('conversation_participants')
          .select('user_id, profiles(full_name, avatar_url)')
          .eq('conversation_id', convoId)
          .neq('user_id', currentUserId)
          .limit(3)

        if (parts) {
          convo.participants = parts
          const firstPart = parts[0] as any
          if (convo.type === 'direct' && parts.length > 0 && firstPart?.profiles) {
            convo.displayName = firstPart.profiles.full_name || 'Unknown'
            convo.avatarUrl = firstPart.profiles.avatar_url
          } else {
            convo.displayName = convo.name || parts.map((p: any) => p.profiles?.full_name).filter(Boolean).join(', ') || 'Group'
          }
        }
      }

      setConversations(Array.from(convoMap.values()))
    }
    setLoading(false)
  }

  async function handleForward(targetConversationId: string) {
    setForwarding(true)
    const res = await forwardMessage(messageId, targetConversationId)
    if (res.error) {
      toast.error(res.error)
    } else {
      toast.success('Message forwarded')
      onOpenChange(false)
    }
    setForwarding(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Forward Message</DialogTitle>
        </DialogHeader>
        <ScrollArea className="h-[300px] w-full">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No conversations found</p>
          ) : (
            <div className="space-y-1">
              {conversations.map((convo) => (
                <Button
                  key={convo.id}
                  variant="ghost"
                  className="w-full justify-start h-auto py-2.5"
                  onClick={() => handleForward(convo.id)}
                  disabled={forwarding}
                >
                  <Avatar className="h-9 w-9 mr-3 shrink-0">
                    <AvatarImage src={convo.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${convo.id}`} />
                    <AvatarFallback>{convo.displayName?.charAt(0)?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">{convo.displayName}</span>
                </Button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
