"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useScrollRestore } from "@/lib/useScrollRestore"

export default function MyListings({ userId, onCountChange, selfUrl }) {
  const supabase = createClient()

  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useScrollRestore(selfUrl, !loading)

  useEffect(() => {
    if (!userId) return
    loadMyListings()
  }, [userId])

  async function loadMyListings() {
    setLoading(true)
    setError("")

    const { data, error: fetchError } = await supabase
      .from("listings")
      .select(
        `
        *,
        subcategories (
          sub_category_name,
          categories ( category_name )
        ),
        listing_images ( image_url, is_primary )
      `
      )
      .eq("seller_id", userId)
      .order("created_at", { ascending: false })

    if (fetchError) {
      console.error("Error loading your listings:", fetchError)
      setError("Unable to load your listings.")
    }

    setListings(data || [])
    onCountChange?.(data?.length || 0)
    setLoading(false)
  }

  return (
    <section className="listings-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">YOUR ACCOUNT</p>
          <h2>My Listings</h2>
        </div>
        <Link href="/market/create" className="sell-button">
          + Add listing
        </Link>
      </div>

      {error && (
        <div className="error-state">
          <div className="empty-icon">⚠️</div>
          <h3>Something went wrong</h3>
          <p>{error}</p>
          <button type="button" className="retry-button" onClick={loadMyListings}>
            Try again
          </button>
        </div>
      )}

      {loading && !error && <div className="loading">Loading your listings...</div>}

      {!loading && !error && listings.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📦</div>
          <h3>You have no listings</h3>
          <p>Items you put up for sale will appear here.</p>
          <Link href="/market/create" className="sell-button">
            Sell your first item
          </Link>
        </div>
      )}

      {!loading && !error && listings.length > 0 && (
        <div className="listing-grid">
          {listings.map((listing) => {
            const primaryImage =
              listing.listing_images?.find((img) => img.is_primary) ||
              listing.listing_images?.[0]
            const category =
              listing.subcategories?.categories?.category_name || "Other"

            return (
              <article className="listing-card" key={listing.listing_id}>
                <div className="listing-image">
                  {primaryImage?.image_url ? (
                    <img src={primaryImage.image_url} alt={listing.title} />
                  ) : (
                    <div className="no-image">
                      <span>📷</span>
                      <p>No image</p>
                    </div>
                  )}
                  <span className={`status-badge status-${listing.status}`}>
                    {listing.status}
                  </span>
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
                    <Link href={`/market/${listing.listing_id}?from=${encodeURIComponent(selfUrl)}`} className="view-button">
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