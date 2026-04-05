'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendMessage } from '@/lib/actions/chat'
import { Button } from '@/components/ui/button'
import { Mic, Square, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface VoiceRecorderProps {
  conversationId: string
  onSent?: () => void
}

export function VoiceRecorder({ conversationId, onSent }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [duration, setDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop())
        if (timerRef.current) clearInterval(timerRef.current)

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size < 100) return // too short

        setUploading(true)
        try {
          const filePath = `${conversationId}/${crypto.randomUUID()}.webm`
          const { error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(filePath, blob, { cacheControl: '3600', contentType: 'audio/webm' })

          if (uploadError) throw uploadError

          const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(filePath)

          await sendMessage(conversationId, '', {
            message_type: 'audio',
            file_url: urlData.publicUrl,
            file_name: 'Voice Message',
            file_size: blob.size,
            file_mime_type: 'audio/webm',
          })

          onSent?.()
        } catch (err: any) {
          toast.error(err.message || 'Failed to send voice message')
        } finally {
          setUploading(false)
          setDuration(0)
        }
      }

      mediaRecorder.start()
      setRecording(true)
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch (err) {
      toast.error('Microphone access denied')
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setRecording(false)
    }
  }

  if (uploading) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" disabled>
        <Loader2 className="w-5 h-5 animate-spin" />
      </Button>
    )
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex items-center gap-1.5 text-red-500 text-xs font-medium animate-pulse">
          <span className="w-2 h-2 bg-red-500 rounded-full" />
          {Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50"
          onClick={stopRecording}
        >
          <Square className="w-4 h-4 fill-current" />
        </Button>
      </div>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
      onClick={startRecording}
    >
      <Mic className="w-5 h-5" />
    </Button>
  )
}
