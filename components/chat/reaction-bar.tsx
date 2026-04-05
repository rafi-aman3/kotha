'use client'

import { reactToMessage } from '@/lib/actions/chat'
import { toast } from 'sonner'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

interface ReactionBarProps {
  messageId: string
  reactions: any[] // { emoji, user_id, id }[]
  currentUserId: string
  isMe: boolean
}

export function QuickReactionPicker({ messageId, onReacted }: { messageId: string; onReacted?: () => void }) {
  async function handleReact(emoji: string) {
    const res = await reactToMessage(messageId, emoji)
    if (res.error) toast.error(res.error)
    onReacted?.()
  }

  return (
    <div className="flex gap-0.5 bg-white dark:bg-zinc-900 border rounded-full shadow-lg px-1 py-0.5">
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleReact(emoji)}
          className="text-base p-1 rounded-full hover:bg-muted transition-colors hover:scale-125"
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

export function ReactionsDisplay({ reactions, currentUserId }: { reactions: any[]; currentUserId: string }) {
  if (!reactions || reactions.length === 0) return null

  // Group reactions by emoji
  const grouped: Record<string, { count: number; userReacted: boolean }> = {}
  reactions.forEach((r) => {
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, userReacted: false }
    grouped[r.emoji].count++
    if (r.user_id === currentUserId) grouped[r.emoji].userReacted = true
  })

  async function handleToggle(emoji: string) {
    const res = await reactToMessage(reactions[0]?.message_id || '', emoji)
    if (res.error) toast.error(res.error)
  }

  return (
    <div className="flex gap-1 mt-1 flex-wrap">
      {Object.entries(grouped).map(([emoji, { count, userReacted }]) => (
        <button
          key={emoji}
          onClick={() => handleToggle(emoji)}
          className={`text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-0.5 transition-colors
            ${userReacted
              ? 'bg-indigo-100 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700'
              : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200'
            }`}
        >
          <span>{emoji}</span>
          <span className="text-[10px] font-medium">{count}</span>
        </button>
      ))}
    </div>
  )
}
