import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Marketplace from '@/components/Marketplace'

export default async function MarketPage() {
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
    <main className="page">
      <Link href="/" className="back-link">
        &larr; Back
      </Link>
      <h1>Marketplace</h1>
      <p className="subtitle">Logged in as {profile?.full_name || user?.email}</p>
      <Marketplace />
    </main>
  )
}