'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { OAuthButtons } from '@/components/auth/oauth-buttons'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner' // Assuming Toaster is added in layout

export default function RegisterPage() {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function onSubmit(formData: FormData) {
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    
    // basic validation
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirm_password') as string
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    const result = await signup(formData)
    
    if (result?.error) {
      setError(result.error)
    } else if (result?.success) {
      setSuccess(result.success)
      toast.success('Registration successful!', {
        description: 'Please check your email to verify your account.',
      })
    }
    
    setIsLoading(false)
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-50 dark:bg-neutral-950 p-4">
      <Card className="w-full max-w-md shadow-xl border-neutral-200/60 dark:border-neutral-800/60 backdrop-blur-xl bg-white/80 dark:bg-neutral-900/80">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight">Create an account</CardTitle>
          <CardDescription>Join us to connect with friends</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <OAuthButtons />
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-neutral-900 px-2 text-neutral-500">
                Or register with
              </span>
            </div>
          </div>

          {success ? (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg text-center text-sm font-medium">
              {success}
            </div>
          ) : (
            <form action={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  name="full_name"
                  placeholder="John Doe"
                  required
                  className="transition-colors focus-visible:ring-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="m@example.com"
                  required
                  className="transition-colors focus-visible:ring-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="transition-colors focus-visible:ring-indigo-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm Password</Label>
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  required
                  className="transition-colors focus-visible:ring-indigo-500"
                />
              </div>

              {error && (
                <div className="text-sm font-medium text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" disabled={isLoading}>
                {isLoading ? 'Creating account...' : 'Sign up'}
              </Button>
            </form>
          )}
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
