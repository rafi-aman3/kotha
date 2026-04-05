'use client'

import { Button } from '@/components/ui/button'
import { signInWithOAuth } from '@/lib/actions/auth'

export function OAuthButtons() {
  return (
    <div className="flex flex-col gap-2 w-full">
      <Button 
        variant="outline" 
        onClick={() => signInWithOAuth('google')}
        type="button"
      >
        Continue with Google
      </Button>
    </div>
  )
}
