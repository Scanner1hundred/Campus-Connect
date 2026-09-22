import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MarketHeader from "@/components/MarketHeader";
import MessagesInbox from "@/components/MessagesInbox";
import MessageThread from "@/components/MessageThread";
import ReserveForBuyer from "@/components/ReserveForBuyer";
import "@/app/market/messages-notifications.css";

// URL-driven, per §9.8: /market/messages?listing=<listing_id>&with=<userId>&from=<backUrl>
export default async function MessagesPage({ searchParams }) {
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

  const listingId = searchParams?.listing ?? null;
  const withId = searchParams?.with ?? null;
  const from = searchParams?.from ?? "/market";

  const { data: threads } = await supabase
    .from("my_message_threads")
    .select("*")
    .order("last_at", { ascending: false });

  let thread = null;
  let listing = null;
  let isSeller = false;

  if (listingId && withId) {
    const { data: listingRow } = await supabase
      .from("listings")
      .select("listing_id, title, seller_id, reserved_for")
      .eq("listing_id", listingId)
      .single();
    listing = listingRow ?? null;
    isSeller = listing?.seller_id === user.id;

    const { data: msgs } = await supabase
      .from("messages")
      .select("message_id, sender_id, receiver_id, message, created_at, is_read")
      .eq("listing_id", listingId)
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${withId}),and(sender_id.eq.${withId},receiver_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true });
    thread = msgs ?? [];

    await supabase
      .from("messages")
      .update({ is_read: true })
      .eq("listing_id", listingId)
      .eq("sender_id", withId)
      .eq("receiver_id", user.id)
      .eq("is_read", false);
  }

  // Only the seller sees Reserve-for-buyer, and only needs the alphabetical
  // list of everyone who's messaged them about this listing. `messages` has
  // no FK straight into `profiles`, so names are looked up separately
  // (same pattern the listing page already uses via public_profiles).
  let messagers = [];
  if (listing && isSeller) {
    const { data: rows } = await supabase
      .from("messages")
      .select("sender_id")
      .eq("listing_id", listing.listing_id)
      .eq("receiver_id", user.id);
    const senderIds = [...new Set((rows ?? []).map((r) => r.sender_id))];
    if (senderIds.length > 0) {
      const { data: people } = await supabase
        .from("public_profiles")
        .select("id, full_name")
        .in("id", senderIds);
      messagers = (people ?? [])
        .map((p) => ({ id: p.id, name: p.full_name ?? "Unknown" }))
        .sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  return (
    <div className="market-shell">
      <MarketHeader displayName={displayName} backHref={from} backLabel="Back" />
      <div className="msg-shell">
        <MessagesInbox threads={threads ?? []} activeListingId={listingId} activeWithId={withId} />

        {thread ? (
          <div className="msg-thread-col">
            {isSeller && listing && (
              <ReserveForBuyer
                listingId={listing.listing_id}
                reservedFor={listing.reserved_for}
                messagers={messagers}
              />
            )}
            <MessageThread
              listingId={listingId}
              listingTitle={listing?.title}
              withId={withId}
              currentUserId={user.id}
              initialMessages={thread}
              backHref={from}
            />
          </div>
        ) : (
          <div className="msg-empty">Pick a conversation, or message a seller from a listing page.</div>
        )}
      </div>
    </div>
  );
}
