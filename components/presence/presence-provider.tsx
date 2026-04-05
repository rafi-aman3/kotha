'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const supabase = createClient()
    
    // Check if the user is logged in
    const startPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Update status to online
      const updateStatus = async (status: 'online' | 'offline' | 'away') => {
        await supabase
          .from('profiles')
          .update({ 
            status_mode: status, 
            last_seen: new Date().toISOString() 
          })
          .eq('id', user.id)
      }

      // Initial status
      await updateStatus('online')

      // Handle visibility changes
      const handleVisibilityChange = async () => {
        if (document.visibilityState === 'visible') {
          await updateStatus('online')
        } else {
          await updateStatus('away')
        }
      }

      document.addEventListener('visibilitychange', handleVisibilityChange)

      // Handle window close
      const handleBeforeUnload = () => {
        const beaconData = JSON.stringify({ status_mode: 'offline', last_seen: new Date().toISOString() })
        // Note: fetch or sendBeacon might be unreliable on unload, but we'll try our best
        // This is a common limitation of client-only presence tracking without WebSockets.
        // For production, Supabase Realtime Presence channel with a backend listener is better.
        // We'll also just aggressively use beforeunload
        supabase.from('profiles').update({ status_mode: 'offline', last_seen: new Date().toISOString() }).eq('id', user.id)
      }

      window.addEventListener('beforeunload', handleBeforeUnload)

      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
        window.removeEventListener('beforeunload', handleBeforeUnload)
        updateStatus('offline')
      }
    }

    startPresence()
    
  }, [])

  return <>{children}</>
}
