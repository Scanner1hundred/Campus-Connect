import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { updateProfile } from './actions'

export default async function ProfilePage({ searchParams }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <main className="page">
      <Link href="/" className="back-link">
        &larr; Back
      </Link>
      <h1>My Profile</h1>
      <p className="subtitle">
        This one profile is used across both the Marketplace and Laundry Booking modules.
      </p>

      {searchParams?.message && <p className="notice success">{searchParams.message}</p>}
      {searchParams?.error && <p className="notice error">{searchParams.error}</p>}

      <form action={updateProfile} className="profile-form">
        <label>
          Full Name
          <input type="text" name="full_name" defaultValue={profile?.full_name || ''} required />
        </label>
        <label>
          Student Number
          <input
            type="text"
            name="student_number"
            defaultValue={profile?.student_number || ''}
            required
          />
        </label>
        <label>
          Phone Number
          <input type="tel" name="phone" defaultValue={profile?.phone || ''} />
        </label>
        <p className="email-note">Email: {user.email}</p>
        <button type="submit" className="btn-primary">
          Save Profile
        </button>
      </form>
    </main>
  )
}
