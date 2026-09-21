import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MarketHeader from '@/components/MarketHeader'
import MyRentals from '@/components/MyRentals'

export default async function RentalsPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: role }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
  ])

  const displayName = profile?.full_name || user.user_metadata?.full_name || user.email

  return (
    <div className="market-shell">
      <MarketHeader displayName={displayName} />
      <MyRentals userId={user.id} isAdmin={role?.role === 'admin'} />
    </div>
  )
}
