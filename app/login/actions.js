'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(formData) {
  const supabase = createClient()
  const email = formData.get('email')
  const password = formData.get('password')

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=' + encodeURIComponent(error.message))
  }

  redirect('/')
}

export async function signup(formData) {
  const supabase = createClient()
  const email = formData.get('email')
  const password = formData.get('password')
  const name = formData.get('name')
  const surname = formData.get('surname')
  const full_name = `${name} ${surname}`.trim()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name },
    },
  })

  if (error) {
    redirect('/signup?error=' + encodeURIComponent(error.message))
  }

  redirect(
    '/login?message=' +
      encodeURIComponent('Account created. Check your email to confirm, then log in.')
  )
}
