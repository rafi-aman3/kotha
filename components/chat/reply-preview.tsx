'use client'

import { Reply, X } from 'lucide-react'

interface ReplyPreviewProps {
  replyingTo: any
  onCancel: () => void
}

export function ReplyPreview({ replyingTo, onCancel }: ReplyPreviewProps) {
  if (!replyingTo) return null

  const snippet = replyingTo.content
    ? replyingTo.content.substring(0, 80) + (replyingTo.content.length > 80 ? '...' : '')
    : replyingTo.message_type === 'image' ? '📷 Image'
    : replyingTo.message_type === 'video' ? '🎬 Video'
    : replyingTo.message_type === 'audio' ? '🎤 Voice Message'
    : replyingTo.message_type === 'file' ? `📎 ${replyingTo.file_name || 'File'}`
    : 'Message'

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/30 border-l-4 border-indigo-500 mx-3 rounded-r-lg">
      <Reply className="w-4 h-4 text-indigo-500 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
          Replying to message
        </p>
        <p className="text-xs text-muted-foreground truncate">{snippet}</p>
      </div>
      <button onClick={onCancel} className="p-1 rounded-full hover:bg-muted shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
