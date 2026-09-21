import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MarketHeader from '@/components/MarketHeader'
import AdminRentalIssues from '@/components/AdminRentalIssues'

// Admin-only: review breakage reports. (The database functions check the role again.)
export default async function AdminRentalsPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: role }, { data: profile }] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ])

  if (role?.role !== 'admin') redirect('/market')

  const displayName = profile?.full_name || user.user_metadata?.full_name || user.email

  return (
    <div className="market-shell">
      <MarketHeader displayName={displayName} backHref="/market/rentals" backLabel="Back to My Rentals" />
      <AdminRentalIssues />
    </div>
  )
}
