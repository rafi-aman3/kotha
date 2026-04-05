'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateProfile, deleteAccount, signout } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea' // Need to install textarea, I'll assume we use Input but better to implement textarea. Assuming input for now if missing. Let's use generic input for bio if textarea isn't installed. Wait, I should use a generic textarea HTML element.
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { signoutOfOtherDevices } from '@/lib/actions/auth'

export default function SettingsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
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

      if (data) {
        setProfile(data)
      }
      setLoading(false)
    }
    loadProfile()
  }, [])

  async function handleProfileSubmit(formData: FormData) {
    const result = await updateProfile(formData)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(result.success)
      router.refresh()
    }
  }

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true)
      if (!event.target.files || event.target.files.length === 0) return

      const file = event.target.files[0]
      const fileExt = file.name.split('.').pop()
      const filePath = `${profile.id}-${Math.random()}.${fileExt}`

      // Upload image
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data } = supabase.storage.from('avatars').getPublicUrl(filePath)

      // Update profile
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

  async function handleDeleteAccount() {
    if (confirm('Are you absolutely sure? This action cannot be undone.')) {
      const result = await deleteAccount()
      if (result.error) {
        toast.error(result.error)
      }
    }
  }

  async function handleSignoutOthers() {
    if (confirm('Are you sure you want to sign out of all other devices?')) {
      const result = await signoutOfOtherDevices()
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(result.success)
      }
    }
  }

  if (loading) return <div className="flex justify-center p-10">Loading...</div>

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings and set e-mail preferences.</p>
      </div>
      
      <Tabs defaultValue="general" className="flex flex-col md:flex-row gap-8 items-start">
        <TabsList className="w-full md:w-64 h-auto flex flex-wrap md:flex-col justify-start bg-transparent p-0 md:space-y-1 gap-2 md:gap-0 border-b md:border-b-0 md:border-r border-border pb-4 md:pb-0 md:pr-4">
          <TabsTrigger value="general" className="w-auto md:w-full justify-start px-4 py-2 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none">General</TabsTrigger>
          <TabsTrigger value="privacy" className="w-auto md:w-full justify-start px-4 py-2 rounded-md data-[state=active]:bg-muted data-[state=active]:shadow-none">Privacy</TabsTrigger>
          <TabsTrigger value="account" className="w-auto md:w-full justify-start px-4 py-2 rounded-md data-[state=active]:bg-red-50 dark:data-[state=active]:bg-red-950/30 text-destructive data-[state=active]:text-destructive data-[state=active]:shadow-none">Danger Zone</TabsTrigger>
        </TabsList>

        <div className="flex-1 max-w-3xl">
          <TabsContent value="general" className="m-0 space-y-6 outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your profile details and public presence.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar Section */}
              <div className="flex items-center gap-6">
                <Avatar className="w-24 h-24 border-2">
                  <AvatarImage src={profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.id}`} />
                  <AvatarFallback>{(profile.full_name || 'U').charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Label htmlFor="avatar_upload" className="cursor-pointer bg-secondary px-4 py-2 rounded-md font-medium hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors">
                    {uploading ? 'Uploading...' : 'Change Picture'}
                  </Label>
                  <input
                    type="file"
                    id="avatar_upload"
                    accept="image/*"
                    onChange={uploadAvatar}
                    disabled={uploading}
                    className="hidden"
                  />
                  <p className="text-xs text-muted-foreground">Recommended size: 256x256px.</p>
                </div>
              </div>

              <Separator />

              {/* Profile Form */}
              <form action={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input id="full_name" name="full_name" defaultValue={profile.full_name || ''} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" name="username" defaultValue={profile.username || ''} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status_message">Status Message</Label>
                  <Input id="status_message" name="status_message" defaultValue={profile.status_message || ''} placeholder="What's happening?" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <textarea
                    id="bio"
                    name="bio"
                    defaultValue={profile.bio || ''}
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="Tell us a little about yourself"
                  />
                </div>

                <Button type="submit" className="w-full md:w-auto">Save Changes</Button>
              </form>
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="privacy" className="m-0 space-y-6 outline-none">
          <Card>
            <CardHeader>
              <CardTitle>Privacy Settings</CardTitle>
              <CardDescription>Control who can see your profile and activity.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form action={handleProfileSubmit}>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base">Public Profile</Label>
                    <p className="text-sm text-muted-foreground">Allow anyone to view your profile and see when you are online.</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch id="is_public" name="is_public" defaultChecked={profile.is_public} />
                  </div>
                </div>

                {/* Keep existing profile fields hidden to update together */}
                <input type="hidden" name="full_name" value={profile.full_name || ''} />
                <input type="hidden" name="username" value={profile.username || ''} />
                <input type="hidden" name="status_message" value={profile.status_message || ''} />
                <input type="hidden" name="bio" value={profile.bio || ''} />
                
                <div className="mt-6">
                  <Button type="submit" variant="default" className="w-full md:w-auto">Save Privacy Rules</Button>
                </div>
              </form>

              <Separator />
              
              <div className="space-y-4">
                <div className="space-y-0.5">
                  <Label className="text-base">Active Sessions</Label>
                  <p className="text-sm text-muted-foreground">Manage your active sessions across different devices and browsers.</p>
                </div>
                <Button onClick={handleSignoutOthers} variant="outline" className="w-full md:w-auto">
                  Sign out of all other devices
                </Button>
              </div>
            </CardContent>
          </Card>
          </TabsContent>

          <TabsContent value="account" className="m-0 space-y-6 outline-none">
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive">Danger Zone</CardTitle>
              <CardDescription>Permanently delete your account and all associated data.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <Button onClick={handleDeleteAccount} variant="destructive">
                  Delete Account
                </Button>
              </div>
            </CardContent>
          </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
