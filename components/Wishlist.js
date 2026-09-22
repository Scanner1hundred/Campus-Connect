"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useScrollRestore } from "@/lib/useScrollRestore"

export default function Wishlist({ userId, onCountChange, selfUrl }) {
  const supabase = createClient()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useScrollRestore(selfUrl, !loading)

  useEffect(() => {
    if (!userId) return
    loadWishlist()
  }, [userId])

  async function loadWishlist() {
    setLoading(true)
    setError("")

    const { data, error: fetchError } = await supabase
      .from("favorites")
      .select(
        `
        favorite_id,
        listing_id,
        listings (
          *,
          subcategories (
            sub_category_name,
            categories ( category_name )
          ),
          listing_images ( image_url, is_primary )
        )
      `
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (fetchError) {
      console.error("Error loading wishlist:", fetchError)
      setError("Unable to load your wishlist.")
    }

    // A favorited listing that has since been deleted leaves a null `listings` row — drop those.
    const valid = (data || []).filter((row) => row.listings)
    setItems(valid)
    onCountChange?.(valid.length)
    setLoading(false)
  }

  async function removeFavorite(listingId) {
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("listing_id", listingId)

    if (deleteError) {
      console.error("Error removing favorite:", deleteError)
      alert("Unable to remove this item from your wishlist.")
      return
    }

    setItems((current) => {
      const next = current.filter((row) => row.listing_id !== listingId)
      onCountChange?.(next.length)
      return next
    })
  }

  return (
    <section className="listings-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">SAVED ITEMS</p>
          <h2>My Wishlist</h2>
        </div>
        <span className="listing-count">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      {error && (
        <div className="error-state">
          <div className="empty-icon">⚠️</div>
          <h3>Something went wrong</h3>
          <p>{error}</p>
          <button type="button" className="retry-button" onClick={loadWishlist}>
            Try again
          </button>
        </div>
      )}

      {loading && !error && <div className="loading">Loading your wishlist...</div>}

      {!loading && !error && items.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">❤️</div>
          <h3>Your wishlist is empty</h3>
          <p>Click the heart on an item to save it here.</p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="listing-grid">
          {items.map(({ listing_id, listings: listing }) => {
            const primaryImage =
              listing.listing_images?.find((img) => img.is_primary) ||
              listing.listing_images?.[0]
            const category =
              listing.subcategories?.categories?.category_name || "Other"

            return (
              <article className="listing-card" key={listing_id}>
                <div className="listing-image">
                  {primaryImage?.image_url ? (
                    <img src={primaryImage.image_url} alt={listing.title} />
                  ) : (
                    <div className="no-image">
                      <span>📷</span>
                      <p>No image</p>
                    </div>
                  )}
                  <button
                    type="button"
                    className="favorite-button"
                    onClick={() => removeFavorite(listing_id)}
                    aria-label="Remove from wishlist"
                  >
                    ❤️
                  </button>
                </div>

                <div className="listing-content">
                  <p className="listing-category">{category}</p>
                  <h3>{listing.title}</h3>
                  <p className="listing-description">
                    {listing.description || "No description provided."}
                  </p>

                  <div className="listing-bottom">
                    <div className="price-area">
                      <strong>R{Number(listing.price || 0).toFixed(2)}</strong>
                      <span>{listing.condition || "Used"}</span>
                    </div>
                    <Link href={`/market/${listing_id}?from=${encodeURIComponent(selfUrl)}`} className="view-button">
                      View
                    </Link>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}