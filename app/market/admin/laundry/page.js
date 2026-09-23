import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MarketHeader from '@/components/MarketHeader'
import AdminLaundry from '@/components/AdminLaundry'

export const metadata = {
  title: 'Laundry Admin | Campus Connect',
}

// Admin-only: add/remove machines, look up bookings by day.
// (laundry_machines/laundry_bookings RLS checks the role again.)
export default async function AdminLaundryPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: role }, { data: profile }] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', user.id).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ])

  if (role?.role !== 'admin') redirect('/laundry')

  const displayName = profile?.full_name || user.user_metadata?.full_name || user.email

  return (
    <div className="market-shell">
      <MarketHeader displayName={displayName} backHref="/laundry" backLabel="Back to Laundry" showAdminToggle />
      <AdminLaundry />
    </div>
  )
}
