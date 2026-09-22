import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import MarketHeader from "@/components/MarketHeader";
import EditListingForm from "@/components/EditListingForm";
import "@/app/market/messages-notifications.css";

export default async function EditListingPage({ params }) {
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

  const { data: listing } = await supabase
    .from("listings")
    .select(
      "listing_id, title, description, price, sub_category_id, condition, status, seller_id, rent_price_monthly, rent_to_buy_enabled"
    )
    .eq("listing_id", params.id)
    .single();

  if (!listing) notFound();
  if (listing.seller_id !== user.id) redirect(`/market/${params.id}`);
  if (listing.status !== "active") redirect(`/market/${params.id}`);

  const { data: images } = await supabase
    .from("listing_images")
    .select("image_id, image_url, is_primary")
    .eq("listing_id", params.id)
    .order("is_primary", { ascending: false });

  const { data: subcategories } = await supabase
    .from("subcategories")
    .select("sub_category_id, sub_category_name, category_id, rent_eligible, rent_min_months");

  return (
    <div className="market-shell">
      <MarketHeader displayName={displayName} backHref={`/market/${params.id}`} backLabel="Back to listing" />
      <EditListingForm listing={listing} images={images ?? []} subcategories={subcategories ?? []} />
    </div>
  );
}
