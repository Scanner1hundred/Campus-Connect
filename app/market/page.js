import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Marketplace from '@/components/Marketplace'

export default async function MarketPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="page">
      <Link href="/" className="back-link">
        &larr; Back
      </Link>

      <h1>Marketplace</h1>

      <p className="subtitle">
        Logged in as {user?.email}
      </p>

      <Marketplace />
    </main>
  )
}
