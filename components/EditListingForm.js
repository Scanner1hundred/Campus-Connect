"use client";

import { useState, useTransition } from "react";
import {
  updateListing,
  addListingImage,
  removeListingImage,
  makeImagePrimary,
} from "@/app/market/[id]/edit/actions";

export default function EditListingForm({ listing, images, subcategories }) {
  const [photos, setPhotos] = useState(images);
  const [subCategoryId, setSubCategoryId] = useState(listing.sub_category_id);
  const [error, setError] = useState(null);
  const [isPending, startTransition] = useTransition();

  const selectedSub = subcategories.find((s) => s.sub_category_id === subCategoryId);
  const rentEligible = !!selectedSub?.rent_eligible;

  function handleSubmit(formData) {
    setError(null);
    startTransition(async () => {
      const res = await updateListing(listing.listing_id, formData);
      if (res?.error) setError(res.error);
      // On success the action redirects, so nothing else to do here.
    });
  }

  async function handleAddPhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const res = await addListingImage(listing.listing_id, file);
    if (res?.error) {
      setError(res.error);
      return;
    }
    setPhotos((p) => [
      ...p,
      { image_id: `temp-${Date.now()}`, image_url: URL.createObjectURL(file), is_primary: false },
    ]);
  }

  async function handleRemovePhoto(imageId) {
    setPhotos((p) => p.filter((img) => img.image_id !== imageId));
    await removeListingImage(imageId, listing.listing_id);
  }

  async function handleMakePrimary(imageId) {
    setPhotos((p) => p.map((img) => ({ ...img, is_primary: img.image_id === imageId })));
    await makeImagePrimary(imageId, listing.listing_id);
  }

  return (
    <form action={handleSubmit} className="edit-listing-form">
      <h1>Edit listing</h1>

      <label>
        Title
        <input name="title" defaultValue={listing.title} maxLength={120} required />
      </label>

      <label>
        Description
        <textarea name="description" defaultValue={listing.description ?? ""} rows={5} />
      </label>

      <label>
        Price (R)
        <input name="price" type="number" min="0" step="0.01" defaultValue={listing.price} required />
      </label>

      <label>
        Category
        <select
          name="sub_category_id"
          value={subCategoryId}
          onChange={(e) => setSubCategoryId(e.target.value)}
        >
          {subcategories.map((s) => (
            <option key={s.sub_category_id} value={s.sub_category_id}>
              {s.sub_category_name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Condition
        <select name="condition" defaultValue={listing.condition ?? "used"}>
          <option value="new">New</option>
          <option value="like_new">Like new</option>
          <option value="used">Used</option>
          <option value="worn">Well worn</option>
        </select>
      </label>

      {rentEligible && (
        <fieldset className="edit-rent-fieldset">
          <legend>Rent settings</legend>
          <label>
            Monthly rent (R)
            <input
              name="rent_price_monthly"
              type="number"
              min="0"
              step="0.01"
              defaultValue={listing.rent_price_monthly ?? ""}
            />
          </label>
          <label className="edit-checkbox-label">
            <input
              name="rent_to_buy_enabled"
              type="checkbox"
              defaultChecked={listing.rent_to_buy_enabled}
            />
            Allow rent-to-buy (only applies above R2000)
          </label>
        </fieldset>
      )}

      <div className="edit-photos">
        <h3>Photos</h3>
        <div className="edit-photos-grid">
          {photos.map((img) => (
            <div key={img.image_id} className="edit-photo-tile">
              <img src={img.image_url} alt="" />
              {img.is_primary && <span className="edit-photo-primary-badge">Primary</span>}
              <div className="edit-photo-tile-actions">
                {!img.is_primary && (
                  <button type="button" onClick={() => handleMakePrimary(img.image_id)}>
                    Make primary
                  </button>
                )}
                <button type="button" onClick={() => handleRemovePhoto(img.image_id)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
        <label className="edit-photo-add">
          + Add photo
          <input type="file" accept="image/*" onChange={handleAddPhoto} hidden />
        </label>
      </div>

      {error && <p className="msg-error">{error}</p>}

      <div className="edit-listing-actions">
        <button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
