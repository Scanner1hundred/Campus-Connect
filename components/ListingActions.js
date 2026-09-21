"use client"

import { useState } from "react"
import Link from "next/link"
import CheckoutModal from "@/components/CheckoutModal"
import Icon from "@/components/Icon"

// Buy / message buttons on the listing page. (Commit 4 replaces this file to add "Rent".)
export default function ListingActions({ listing, isOwner }) {
  const [mode, setMode] = useState(null) // "buy" | null
  const [done, setDone] = useState(null)

  const available = listing.status === "active" && !done

  if (done) {
    return (
      <div className="ld-success">
        <h3>Order placed 🎉</h3>
        <p>Arrange collection with the seller to complete the hand-over.</p>
        <p className="ld-ref">Reference: {String(done.id).slice(0, 8).toUpperCase()}</p>
        <Link href="/market" className="ld-btn primary ld-btn-sm">Back to marketplace</Link>
      </div>
    )
  }

  if (isOwner) return <p className="ld-owner-note">This is your listing.</p>
  if (!available) return null

  return (
    <>
      <div className="ld-actions">
        <button type="button" className="ld-btn primary" onClick={() => setMode("buy")}>
          <Icon name="cart" size={20} /> Buy Now
        </button>
        <button type="button" className="ld-btn outline" disabled title="Messages are coming soon">
          <Icon name="message" size={20} /> Message Seller (soon)
        </button>
      </div>

      {mode === "buy" && (
        <CheckoutModal
          listing={listing}
          onClose={() => setMode(null)}
          onSuccess={(result) => {
            setMode(null)
            setDone(result)
          }}
        />
      )}
    </>
  )
}
