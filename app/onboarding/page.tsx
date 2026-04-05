'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { completeOnboarding, skipOnboarding } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'

export default function OnboardingPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data?.is_onboarded) {
        // Already onboarded
        router.push('/')
        return
      }

      setProfile(data)
      setLoading(false)
    }
    checkUser()
  }, [])

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true)
      if (!event.target.files || event.target.files.length === 0) return

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const filePath = `${profile.id}-${Math.random()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: data.publicUrl })
        .eq('id', profile.id)

      if (updateError) throw updateError
      
      setProfile({ ...profile, avatar_url: data.publicUrl })
      toast.success('Avatar updated successfully')
    } catch (error: any) {
      toast.error('Error uploading avatar: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(formData: FormData) {
    const result = await completeOnboarding(formData)
    if (result?.error) {
      toast.error(result.error)
    }
  }

  if (loading) return <div className="flex justify-center p-10 mt-20">Loading setup...</div>

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)] bg-neutral-50 dark:bg-neutral-950 p-4">
      <Card className="w-full max-w-2xl shadow-xl border-neutral-200/60 dark:border-neutral-800/60">
        <CardHeader className="space-y-2 text-center pb-8 border-b">
          <CardTitle className="text-3xl font-bold tracking-tight">Complete your profile</CardTitle>
          <CardDescription>Tell the community a bit more about yourself before you start.</CardDescription>
        </CardHeader>
        
        <CardContent className="pt-8 space-y-8">
          {/* Avatar Section */}
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-6">
            <Avatar className="w-28 h-28 border-2 border-indigo-100 dark:border-neutral-800 shadow-sm">
               <AvatarImage src={profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile?.id}`} />
               <AvatarFallback>{(profile?.full_name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="space-y-3 text-center sm:text-left flex-1">
              <h3 className="text-lg font-medium">Profile Photo</h3>
              <p className="text-sm text-muted-foreground mr-6">
                A picture helps people recognize you and lets you know when you're signed in to your account.
              </p>
              <div>
                <Label htmlFor="avatar_upload" className="inline-flex cursor-pointer bg-secondary px-4 py-2 rounded-md font-medium hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors">
                  {uploading ? 'Uploading...' : 'Upload new photo'}
                </Label>
                <input
                  type="file"
                  id="avatar_upload"
                  accept="image/*"
                  onChange={uploadAvatar}
                  disabled={uploading}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Profile Details Form */}
          <form action={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" name="full_name" defaultValue={profile?.full_name || ''} required placeholder="e.g. John Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" name="username" defaultValue={profile?.username || ''} required placeholder="Choose a unique handle" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status_message">Current Status</Label>
              <Input id="status_message" name="status_message" defaultValue={profile?.status_message || ''} placeholder="What's on your mind right now?" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">About You</Label>
              <textarea
                id="bio"
                name="bio"
                defaultValue={profile?.bio || ''}
                className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Write a short bio..."
              />
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 w-full">
               <Button type="button" variant="ghost" onClick={async () => { await skipOnboarding() }} className="w-full sm:w-auto text-muted-foreground">Skip for now</Button>
               <Button type="submit" className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white">
                 Complete Setup
               </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
