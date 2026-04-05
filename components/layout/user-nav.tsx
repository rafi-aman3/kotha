'use client'

import Link from "next/link"
import { signout } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface UserNavProps {
  user: any;
  profile: any;
}

export function UserNav({ user, profile }: UserNavProps) {
  const avatarUrl = profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id}`
  const username = profile?.username || "user"
  const fullName = profile?.full_name || "User"
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full focus-visible:ring-offset-0 focus-visible:ring-0">
          <Avatar className="h-10 w-10 border border-neutral-200 dark:border-neutral-800">
            <AvatarImage src={avatarUrl} alt={fullName} />
            <AvatarFallback>{fullName.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{fullName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              @{username}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href={`/profile/${username}`}>
              Profile
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <Link href="/settings">
              Settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer bg-red-50 text-red-500 focus:bg-red-100 focus:text-red-600 dark:bg-red-950/50 dark:text-red-400 dark:focus:bg-red-900/50 dark:focus:text-red-300">
          <form action={signout} className="w-full">
            <button type="submit" className="w-full text-left font-medium">Log out</button>
          </form>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
