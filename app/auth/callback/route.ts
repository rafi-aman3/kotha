import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error, data: authData } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && authData.user) {
      // Check onboarding status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_onboarded')
        .eq('id', authData.user.id)
        .single()
        
      const targetUrl = (profile && !profile.is_onboarded) ? '/onboarding' : next
      const forwardedHost = request.headers.get('x-forwarded-host') 
      const isLocalEnv = process.env.NODE_ENV === 'development'
      
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${targetUrl}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${targetUrl}`)
      } else {
        return NextResponse.redirect(`${origin}${targetUrl}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
