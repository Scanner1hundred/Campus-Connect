"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function sendMessage({ listingId, receiverId, message }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in." };

  const trimmed = (message ?? "").trim();
  if (!trimmed) return { error: "Message can't be empty." };
  if (trimmed.length > 2000) return { error: "Message is too long." };

  const { error } = await supabase.from("messages").insert({
    listing_id: listingId,
    sender_id: user.id,
    receiver_id: receiverId,
    message: trimmed,
  });

  if (error) return { error: error.message };

  revalidatePath("/market/messages");
  return { ok: true };
}

// Seller-only — see reserve_listing_for() in c6_messaging_notifications.sql
// for the actual ownership + "must have messaged you" checks.
export async function reserveForBuyer({ listingId, buyerId }) {
  const supabase = createClient();
  const { error } = await supabase.rpc("reserve_listing_for", {
    p_listing_id: listingId,
    p_buyer_id: buyerId, // pass null to clear the reservation
  });

  if (error) return { error: error.message };

  revalidatePath("/market/messages");
  revalidatePath(`/market/${listingId}`);
  return { ok: true };
}
