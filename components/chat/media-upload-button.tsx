'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendMessage } from '@/lib/actions/chat'
import { Button } from '@/components/ui/button'
import { Paperclip, Image, Film, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

interface MediaUploadButtonProps {
  conversationId: string
  onSent?: () => void
}

export function MediaUploadButton({ conversationId, onSent }: MediaUploadButtonProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [currentAccept, setCurrentAccept] = useState('')
  const [currentType, setCurrentType] = useState<'image' | 'video' | 'file'>('file')

  const supabase = createClient()

  function openFilePicker(accept: string, type: 'image' | 'video' | 'file') {
    setCurrentAccept(accept)
    setCurrentType(type)
    setShowMenu(false)
    // Small delay to let state update
    setTimeout(() => fileInputRef.current?.click(), 50)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum 50MB.')
      return
    }

    setUploading(true)
    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${conversationId}/${crypto.randomUUID()}.${fileExt}`

      const { data, error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(filePath, file, { cacheControl: '3600', upsert: false })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(filePath)

      await sendMessage(conversationId, '', {
        message_type: currentType,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        file_mime_type: file.type,
      })

      onSent?.()
    } catch (err: any) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      // Reset the file input
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (uploading) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" disabled>
        <Loader2 className="w-5 h-5 animate-spin" />
      </Button>
    )
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
        onClick={() => setShowMenu(!showMenu)}
      >
        <Paperclip className="w-5 h-5" />
      </Button>

      {showMenu && (
        <div className="absolute bottom-12 left-0 z-50 bg-white dark:bg-zinc-900 border rounded-xl shadow-xl w-[180px] py-1">
          <button
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors"
            onClick={() => openFilePicker('image/*', 'image')}
          >
            <Image className="w-4 h-4 text-green-500" /> Image
          </button>
          <button
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors"
            onClick={() => openFilePicker('video/*', 'video')}
          >
            <Film className="w-4 h-4 text-blue-500" /> Video
          </button>
          <button
            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm hover:bg-muted transition-colors"
            onClick={() => openFilePicker('*/*', 'file')}
          >
            <FileText className="w-4 h-4 text-orange-500" /> Document
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={currentAccept}
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
