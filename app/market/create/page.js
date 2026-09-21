import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sell from '@/components/sell'

export default async function MarketCreatePage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  const displayName = profile?.full_name || user.user_metadata?.full_name || user.email

  return <Sell displayName={displayName} />
}
