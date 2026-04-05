'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Provider } from '@supabase/supabase-js'

async function getBaseUrl() {
  const headersList = await headers()
  const host = headersList.get('host') || 'localhost:3000'
  const protocol = headersList.get('x-forwarded-proto') || 'http'
  return `${protocol}://${host}`
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: error.message }
  }

  // Check onboarding status
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_onboarded')
    .eq('id', (await supabase.auth.getUser()).data.user?.id)
    .single()

  revalidatePath('/', 'layout')
  
  if (profile && !profile.is_onboarded) {
    redirect('/onboarding')
  }

  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const fullName = formData.get('full_name') as string

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
      emailRedirectTo: `${await getBaseUrl()}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message }
  }

  return { success: 'Check your email to verify your account.' }
}

export async function signInWithOAuth(provider: Provider) {
  const supabase = await createClient()
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider,
    options: {
      redirectTo: `${await getBaseUrl()}/auth/callback`
    }
  })

  if (data.url) {
    redirect(data.url)
  }

  if (error) {
    return { error: error.message }
  }
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  
  revalidatePath('/', 'layout')
  redirect('/login')
}

export async function signoutOfOtherDevices() {
  const supabase = await createClient()
  const { error } = await supabase.auth.signOut({ scope: 'others' })
  
  if (error) {
    return { error: error.message }
  }
  return { success: 'Successfully signed out of all other devices.' }
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  const updates = {
    full_name: formData.get('full_name') as string,
    username: formData.get('username') as string,
    bio: formData.get('bio') as string,
    status_message: formData.get('status_message') as string,
    is_public: formData.get('is_public') === 'on',
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: 'Profile updated successfully' }
}

export async function deleteAccount() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return { error: 'Not authenticated' }
  }

  // To truly delete the user from auth.users, it requires an RPC or service role.
  // We'll call a hypothetical RPC 'delete_user' that the user should create in Supabase.
  const { error } = await supabase.rpc('delete_user')
  
  if (error) {
    return { error: 'Could not delete account. Make sure you added the delete_user RPC.' }
  }

  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  const updates = {
    full_name: formData.get('full_name') as string,
    username: formData.get('username') as string,
    bio: formData.get('bio') as string,
    status_message: formData.get('status_message') as string,
    is_onboarded: true,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function skipOnboarding() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return { error: 'Not authenticated' }

  await supabase
    .from('profiles')
    .update({ is_onboarded: true, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  revalidatePath('/', 'layout')
  redirect('/')
}
