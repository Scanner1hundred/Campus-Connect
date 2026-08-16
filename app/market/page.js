import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

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
      <p className="subtitle">Logged in as {user.email}</p>
      <p>
        This is a placeholder for the used goods marketplace module. Real listing, browsing,
        and buying/selling features will go here.
      </p>
      <div className="placeholder-box">
        Example: a &quot;List an item&quot; form and a grid of listings would render here.
      </div>
    </main>
  )
}
