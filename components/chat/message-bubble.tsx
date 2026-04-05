'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Check, CheckCheck, FileText, Download, Play, Pause } from 'lucide-react'
import { format } from 'date-fns'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useState, useRef } from 'react'

interface MessageBubbleProps {
  msg: any
  isMe: boolean
  isRead: boolean
  isSameSenderAsPrev: boolean
  senderProfile?: any
  isGroup?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function AudioPlayer({ src }: { src: string }) {
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  function togglePlay() {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setPlaying(!playing)
  }

  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => {
          if (audioRef.current) setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100)
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration)
        }}
        onEnded={() => { setPlaying(false); setProgress(0) }}
      />
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full" onClick={togglePlay}>
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </Button>
      <div className="flex-1 flex flex-col gap-1">
        <div className="h-1.5 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-current rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[10px] opacity-70">
          {duration > 0 ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}` : '0:00'}
        </span>
      </div>
    </div>
  )
}

export default function MessageBubble({ msg, isMe, isRead, isSameSenderAsPrev, senderProfile, isGroup }: MessageBubbleProps) {
  const messageType = msg.message_type || 'text'

  function renderContent() {
    switch (messageType) {
      case 'image':
        return (
          <div className="space-y-1">
            <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
              <img
                src={msg.file_url}
                alt={msg.file_name || 'Image'}
                className="max-w-full max-h-[300px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
              />
            </a>
            {msg.content && <p className="text-sm whitespace-pre-wrap mt-1">{msg.content}</p>}
          </div>
        )

      case 'video':
        return (
          <div className="space-y-1">
            <video
              src={msg.file_url}
              controls
              className="max-w-full max-h-[300px] rounded-lg"
              preload="metadata"
            />
            {msg.content && <p className="text-sm whitespace-pre-wrap mt-1">{msg.content}</p>}
          </div>
        )

      case 'audio':
        return <AudioPlayer src={msg.file_url} />

      case 'file':
        return (
          <a
            href={msg.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 p-2 rounded-lg border ${isMe ? 'border-indigo-400/30 hover:bg-indigo-500/20' : 'border-zinc-200 dark:border-zinc-700 hover:bg-muted/50'} transition-colors`}
          >
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isMe ? 'bg-indigo-400/20' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{msg.file_name || 'Document'}</p>
              <p className="text-[10px] opacity-60">{msg.file_size ? formatFileSize(msg.file_size) : ''}</p>
            </div>
            <Download className="w-4 h-4 opacity-50 shrink-0" />
          </a>
        )

      default: // 'text' — render as markdown
        return (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <span className="whitespace-pre-wrap">{children}</span>,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className={`underline ${isMe ? 'text-indigo-200 hover:text-white' : 'text-indigo-600 dark:text-indigo-400'}`}>
                  {children}
                </a>
              ),
              strong: ({ children }) => <strong className="font-bold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              del: ({ children }) => <del className="line-through opacity-70">{children}</del>,
              code: ({ className, children, ...props }) => {
                const match = /language-(\w+)/.exec(className || '')
                const isInline = !match
                if (isInline) {
                  return (
                    <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${isMe ? 'bg-indigo-500/30' : 'bg-zinc-200 dark:bg-zinc-800'}`}>
                      {children}
                    </code>
                  )
                }
                return (
                  <SyntaxHighlighter
                    style={oneDark}
                    language={match[1]}
                    PreTag="div"
                    className="!rounded-lg !text-xs !my-2"
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                )
              },
            }}
          >
            {msg.content || ''}
          </ReactMarkdown>
        )
    }
  }

  return (
    <div className={`flex flex-col gap-1 w-fit max-w-[75%] ${isMe ? 'self-end' : 'self-start'} ${isSameSenderAsPrev ? 'mt-0' : 'mt-2'}`}>
      {/* Show sender name in group chats */}
      {isGroup && !isMe && !isSameSenderAsPrev && senderProfile && (
        <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 ml-1 mb-0.5">
          {senderProfile.full_name}
        </span>
      )}
      <div className={`px-4 py-2 rounded-2xl text-[15px] leading-relaxed shadow-sm break-words
        ${isMe ? 'bg-indigo-600 text-white rounded-br-sm' : 'bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-bl-sm'}
        ${messageType !== 'text' ? 'p-2' : ''}
      `}>
        {renderContent()}
        <div className={`flex items-center justify-end gap-1 mt-1 -mb-1 ${isMe ? 'text-indigo-200' : 'text-muted-foreground'}`}>
          <span className="text-[10px]">{format(new Date(msg.created_at), 'hh:mm a')}</span>
          {isMe && (
            isRead ? <CheckCheck className="w-3 h-3 text-blue-300" /> : <Check className="w-3 h-3" />
          )}
        </div>
      </div>
    </div>
  )
}
