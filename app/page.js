import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { signOut } from './actions'
import { MarketIcon, LaundryIcon } from '@/components/icons'

export default async function Home() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()

  return (
    <main className="landing">
      <header className="landing-header">
        <h1>Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}</h1>
        <div className="header-actions">
          <Link href="/profile">Profile</Link>
          <form action={signOut}>
            <button type="submit" className="btn-link">
              Log out
            </button>
          </form>
        </div>
      </header>

      <p className="landing-subtitle">Choose where you&apos;d like to go</p>

      <div className="module-grid">
        <Link href="/market" className="module-card">
          <MarketIcon />
          <span>Marketplace</span>
        </Link>
        <Link href="/laundry" className="module-card">
          <LaundryIcon />
          <span>Laundry Booking</span>
        </Link>
      </div>
    </main>
  )
}
