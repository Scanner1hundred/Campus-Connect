import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function LaundryPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="page">
      <Link href="/" className="back-link">
        &larr; Back
      </Link>
      <h1>Laundry Booking</h1>
      <p className="subtitle">Logged in as {user.email}</p>
      <p>
        This is a placeholder for the laundry booking module. Real time-slot booking and
        double-booking prevention logic will go here.
      </p>
      <div className="placeholder-box">
        Example: a time-slot picker and a list of your upcoming bookings would render here.
      </div>
    </main>
  )
}
