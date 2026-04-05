import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { signout } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { UserNav } from "./user-nav"

export default async function Navbar() {
  const supabase = await createClient()
  
  // Try to get the user
  const { data: { user } } = await supabase.auth.getUser()
  let profile = null

  // If we have a user, fetch their profile data
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      
    profile = data
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex gap-6 md:gap-10">
          <Link href="/" className="flex items-center space-x-2">
            <span className="inline-block font-bold text-xl tracking-tight text-indigo-600 dark:text-indigo-400">
              Kotha
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-4">
            {user ? (
              <>
                <Link href="/messages">
                  <Button variant="ghost" className="text-sm font-medium">
                    Messages
                  </Button>
                </Link>
                <UserNav user={user} profile={profile} />
                <form action={signout}>
                  <Button variant="ghost" type="submit" className="text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50">
                    Log out
                  </Button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" className="text-sm font-medium">
                    Sign In
                  </Button>
                </Link>
                <Link href="/register">
                  <Button className="text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
