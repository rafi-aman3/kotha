import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface ProfileProps {
  params: Promise<{
    username: string
  }>
}

export default async function ProfilePage({ params }: ProfileProps) {
  const resolvedParams = await params;
  const username = resolvedParams.username
  const supabase = await createClient()

  // Verify the viewer's identity to see if it's their own profile
  const { data: { user } } = await supabase.auth.getUser()
  
  // Try to fetch the profile. RLS will automatically hide it if it's private and not owned by the user.
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', username)
    .single()

  if (!profile) {
    // If not found, it could mean the profile does not exist OR is private to the viewer
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Profile Unavailable</h1>
          <p className="text-muted-foreground">This profile is either private or does not exist.</p>
        </div>
      </div>
    )
  }

  const isOwner = user?.id === profile.id

  // Calculate status indicator color
  const isOnline = profile.status_mode === 'online'
  const isAway = profile.status_mode === 'away'
  const statusColor = isOnline ? 'bg-green-500' : isAway ? 'bg-yellow-500' : 'bg-neutral-500'

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8">
      <Card className="overflow-hidden">
        <div className="h-48 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 relative">
          {/* Cover photo placeholder */}
        </div>
        <CardContent className="relative px-6 pb-6 pt-0 sm:px-8">
          <div className="relative -mt-16 sm:-mt-20 flex justify-between items-end">
            <div className="relative inline-block border-4 border-white dark:border-neutral-900 rounded-full bg-white dark:bg-neutral-900">
              <Avatar className="w-24 h-24 sm:w-32 sm:h-32">
                <AvatarImage src={profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.id}`} alt={profile.full_name || username} />
                <AvatarFallback>{(profile.full_name || username).charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className={`absolute bottom-2 right-2 w-5 h-5 rounded-full border-2 border-white dark:border-neutral-900 ${statusColor}`} title={`Status: ${profile.status_mode}`} />
            </div>
            
            {isOwner && (
              <Badge variant="secondary" className="mb-2">Your Profile</Badge>
            )}
          </div>

          <div className="mt-6 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold">{profile.full_name || 'Anonymous User'}</h1>
              <p className="text-muted-foreground font-medium">@{profile.username}</p>
            </div>
            {profile.last_seen && (
               <div className="text-sm text-muted-foreground text-center sm:text-right">
                 Last seen: {new Date(profile.last_seen).toLocaleString()}
               </div>
            )}
          </div>

          {(profile.bio || profile.status_message) && (
            <div className="mt-8 space-y-4">
              {profile.status_message && (
                <div className="p-4 bg-muted rounded-lg text-sm italic border-l-4 border-indigo-500">
                  "{profile.status_message}"
                </div>
              )}
              {profile.bio && (
                <div className="prose dark:prose-invert max-w-none">
                  <p>{profile.bio}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
