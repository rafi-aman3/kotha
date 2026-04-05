import { MessageSquare } from 'lucide-react'

export default function MessagesEmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center flex-col text-center p-8 bg-zinc-50/50 dark:bg-black">
      <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 rounded-full flex items-center justify-center mb-6 shadow-sm">
        <MessageSquare className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight">Your Messages</h2>
      <p className="text-muted-foreground mt-2 max-w-sm">
        Select an existing conversation from the sidebar or start a new connection to begin chatting instantly.
      </p>
    </div>
  )
}
