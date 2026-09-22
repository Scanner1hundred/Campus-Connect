import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MarketHeader from "@/components/MarketHeader";
import NotificationsList from "@/components/NotificationsList";
import "@/app/market/messages-notifications.css";

export default async function NotificationsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  const displayName = profile?.full_name || user.user_metadata?.full_name || user.email;

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="market-shell">
      <MarketHeader displayName={displayName} />
      <div className="notif-shell">
        <h2 className="notif-title">Notifications</h2>
        <NotificationsList initialNotifications={notifications ?? []} />
      </div>
    </div>
  );
}
