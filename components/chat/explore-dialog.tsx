'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import { searchUsers, getOrCreateDirectChat, createGroupChat } from '@/lib/actions/chat'
import { UserPlus, MessageSquarePlus, Users, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDebounce } from '@/lib/hooks/use-debounce' // Need to create this or just use inline timeout

export function ExploreDialog() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [startingChat, setStartingChat] = useState(false)
  
  // Group selection state
  const [groupName, setGroupName] = useState('')
  const [selectedUsers, setSelectedUsers] = useState<any[]>([])

  const router = useRouter()

  // Load suggestions when dialog opens
  useEffect(() => {
    if (open) {
      loadUsers('')
    }
  }, [open])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      loadUsers(query)
    }, 500)

    return () => clearTimeout(delayDebounceFn)
  }, [query])

  async function loadUsers(q: string) {
    setLoading(true)
    const { users, error } = await searchUsers(q)
    if (!error && users) {
      setResults(users)
    }
    setLoading(false)
  }

  async function startDirectMessage(userId: string) {
    try {
      setStartingChat(true)
      const res = await getOrCreateDirectChat(userId)
      if (res.error) throw new Error(res.error)
      
      setOpen(false)
      router.push(`/messages/${res.conversation_id}`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to start chat')
    } finally {
      setStartingChat(false)
    }
  }

  function toggleUserSelection(user: any) {
    if (selectedUsers.find(u => u.id === user.id)) {
      setSelectedUsers(selectedUsers.filter(u => u.id !== user.id))
    } else {
      setSelectedUsers([...selectedUsers, user])
    }
  }

  async function handleCreateGroup() {
    if (!groupName.trim()) return toast.error('Group name required')
    if (selectedUsers.length === 0) return toast.error('Check at least one member')
    
    try {
      setStartingChat(true)
      const memberIds = selectedUsers.map(u => u.id)
      const res = await createGroupChat(groupName, memberIds)
      
      if (res.error) throw new Error(res.error)
      
      setOpen(false)
      router.push(`/messages/${res.conversation_id}`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create group')
    } finally {
      setStartingChat(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full justify-start text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 gap-2 mb-4">
          <MessageSquarePlus className="w-4 h-4" />
          New Connection
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Explore & Connect</DialogTitle>
          <DialogDescription>
            Search for people or create a new group chat.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="direct" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="direct">Direct Message</TabsTrigger>
            <TabsTrigger value="group">Create Group</TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-4 mt-4">
            <Input
              placeholder="Search by username or name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ScrollArea className="h-[250px] w-full rounded-md border p-2">
              {loading && <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>}
              {!loading && results.length === 0 && query.trim() !== '' && (
                <div className="p-4 text-center text-sm text-muted-foreground">No users found.</div>
              )}
              <div className="space-y-2 flex flex-col">
                {results.map((u) => (
                  <Button
                    key={u.id}
                    variant="ghost"
                    className="w-full justify-start min-h-[60px] py-2 h-auto text-left"
                    onClick={() => startDirectMessage(u.id)}
                    disabled={startingChat}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 shrink-0">
                         <AvatarImage src={u.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`} />
                         <AvatarFallback>{u.full_name?.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col overflow-hidden">
                        <span className="font-medium truncate">{u.full_name}</span>
                        <span className="text-xs text-muted-foreground truncate">@{u.username}</span>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="group" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="group_name">Group Name</Label>
              <Input
                id="group_name"
                placeholder="Marketing Team Sync..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Search Members</Label>
              <Input
                placeholder="Search to add members..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2 pb-2">
                {selectedUsers.map(u => (
                  <div key={u.id} className="flex items-center bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs rounded-full px-3 py-1">
                    {u.full_name}
                    <button onClick={() => toggleUserSelection(u)} className="ml-2 font-bold hover:text-red-500">×</button>
                  </div>
                ))}
              </div>
            )}

            <ScrollArea className="h-[180px] w-full rounded-md border p-2">
              {loading && <div className="p-4 text-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin mx-auto" /></div>}
              <div className="space-y-2 flex flex-col">
                {results.map((u) => {
                  const isSelected = !!selectedUsers.find(sel => sel.id === u.id)
                  return (
                    <Button
                      key={u.id}
                      variant={isSelected ? "secondary" : "ghost"}
                      className="w-full justify-start min-h-[60px] py-2 h-auto text-left"
                      onClick={() => toggleUserSelection(u)}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 shrink-0">
                           <AvatarImage src={u.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`} />
                           <AvatarFallback>{u.full_name?.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium truncate">{u.full_name}</span>
                          <span className="text-xs text-muted-foreground truncate">@{u.username}</span>
                        </div>
                      </div>
                    </Button>
                  )
                })}
              </div>
            </ScrollArea>
            
            <Button className="w-full" onClick={handleCreateGroup} disabled={startingChat || !groupName || selectedUsers.length === 0}>
              {startingChat ? 'Creating...' : 'Create Group'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
