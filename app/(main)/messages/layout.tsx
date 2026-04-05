import { createClient } from '@/lib/supabase/server'
import ChatSidebar from '@/components/chat/chat-sidebar'

export const metadata = {
  title: 'Messages | Kotha',
}

export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden w-full max-w-7xl mx-auto border-x bg-background">
      <ChatSidebar initialUserId={user?.id || ''} />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative border-r">
        {children}
      </div>
    </div>
  )
}
