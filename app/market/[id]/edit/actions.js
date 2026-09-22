"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateListing(listingId, formData) {
  const supabase = createClient();

  const payload = {
    p_listing_id: listingId,
    p_title: formData.get("title")?.toString().trim(),
    p_description: formData.get("description")?.toString().trim() ?? "",
    p_price: Number(formData.get("price")),
    p_sub_category_id: formData.get("sub_category_id")?.toString(),
    p_condition: formData.get("condition")?.toString() ?? null,
    p_rent_price_monthly: formData.get("rent_price_monthly")
      ? Number(formData.get("rent_price_monthly"))
      : null,
    p_rent_to_buy_enabled: formData.get("rent_to_buy_enabled") === "on",
  };

  if (!payload.p_title || !payload.p_price || Number.isNaN(payload.p_price)) {
    return { error: "Title and a valid price are required." };
  }

  const { error } = await supabase.rpc("update_listing", payload);
  if (error) return { error: error.message };

  revalidatePath(`/market/${listingId}`);
  redirect(`/market/${listingId}`);
}

// Uses the same public listing-images bucket + RLS you already have (§5/§9.9):
// users can only delete files under their own uploader-id folder.
export async function addListingImage(listingId, file) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not logged in." };

  const path = `${user.id}/${listingId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from("listing-images")
    .upload(path, file);
  if (uploadError) return { error: uploadError.message };

  const { data: pub } = supabase.storage.from("listing-images").getPublicUrl(path);

  const { error: insertError } = await supabase.from("listing_images").insert({
    listing_id: listingId,
    image_url: pub.publicUrl,
    is_primary: false,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath(`/market/${listingId}/edit`);
  return { ok: true };
}

export async function removeListingImage(imageId, listingId) {
  const supabase = createClient();
  const { error } = await supabase.from("listing_images").delete().eq("image_id", imageId);
  if (error) return { error: error.message };

  revalidatePath(`/market/${listingId}/edit`);
  return { ok: true };
}

export async function makeImagePrimary(imageId, listingId) {
  const supabase = createClient();
  // Clear any existing primary, then set the chosen one — two statements,
  // not atomic, but low-stakes (worst case briefly no/two primaries).
  await supabase.from("listing_images").update({ is_primary: false }).eq("listing_id", listingId);
  const { error } = await supabase
    .from("listing_images")
    .update({ is_primary: true })
    .eq("image_id", imageId);
  if (error) return { error: error.message };

  revalidatePath(`/market/${listingId}/edit`);
  return { ok: true };
}
