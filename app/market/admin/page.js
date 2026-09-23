import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import MarketHeader from '@/components/MarketHeader'
import '@/app/market/admin-dashboard.css'

// Same gate as every /market/admin/* page — the DB functions/RLS re-check
// is_admin() regardless, this is just so non-admins don't land on a blank page.
export default async function AdminDashboardPage() {
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

  // Every admin page lives under /market/admin/* and gets a card here —
  // this is the one place every admin section should be reachable from.
  const sections = [
    {
      href: '/market/admin/rentals',
      title: 'Rental breakage reports',
      description: 'Review reported issues, approve or reject refunds.',
    },
    {
      href: '/market/admin/laundry',
      title: 'Laundry machines & bookings',
      description: 'Add or take machines offline, look up bookings by day.',
    },
  ]

  return (
    <div className="market-shell">
      <MarketHeader displayName={displayName} backHref="/market" backLabel="Back to Marketplace" showAdminToggle />
      <div className="admin-dashboard">
        <h1>Admin</h1>
        <div className="admin-dashboard-grid">
          {sections.map((s) => (
            <Link key={s.href} href={s.href} className="admin-dashboard-card">
              <h2>{s.title}</h2>
              <p>{s.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
