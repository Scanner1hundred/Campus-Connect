import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import MarketShell from '@/components/MarketShell'

export default async function MarketPage() {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // maybeSingle() returns null (not an error) if the profile row doesn't exist yet
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .maybeSingle()

  // Name from profiles table -> name saved at signup -> email as last resort
  const displayName =
    profile?.full_name || user.user_metadata?.full_name || user.email

  return <MarketShell displayName={displayName} />
}