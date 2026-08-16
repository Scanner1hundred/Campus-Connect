'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function updateProfile(formData) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const full_name = formData.get('full_name')
  const student_number = formData.get('student_number')
  const phone = formData.get('phone')

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    full_name,
    student_number,
    phone,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    redirect('/profile?error=' + encodeURIComponent(error.message))
  }

  redirect('/profile?message=' + encodeURIComponent('Profile saved'))
}
