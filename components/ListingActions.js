"use client"

import { useState } from "react"
import Link from "next/link"
import CheckoutModal from "@/components/CheckoutModal"
import RentModal from "@/components/RentModal"
import Icon from "@/components/Icon"
import { money } from "@/lib/cards"

// Buy / Rent / message buttons on the listing page.
export default function ListingActions({ listing, isOwner }) {
  const [mode, setMode] = useState(null) // "buy" | "rent" | null
  const [done, setDone] = useState(null)

  const available = listing.status === "active" && !done
  const rentable = listing.rent_price_monthly != null
  const minMonths = listing.subcategories?.rent_min_months || 1
  const maxMonths = listing.rent_to_buy_enabled ? 10 : 6

  if (done) {
    return (
      <div className="ld-success">
        <h3>{done.kind === "rent" ? "Rental started 🎉" : "Order placed 🎉"}</h3>
        <p>
          {done.kind === "rent"
            ? "Your upfront payment is done. Arrange collection with the owner."
            : "Arrange collection with the seller to complete the hand-over."}
        </p>
        <p className="ld-ref">Reference: {String(done.id).slice(0, 8).toUpperCase()}</p>
        <Link href={done.kind === "rent" ? "/market/rentals" : "/market"} className="ld-btn primary ld-btn-sm">
          {done.kind === "rent" ? "View my rentals" : "Back to marketplace"}
        </Link>
      </div>
    )
  }

  if (isOwner) return <p className="ld-owner-note">This is your listing.</p>
  if (!available) return null

  return (
    <>
      {rentable && (
        <div className="ld-rent-box">
          <strong>Rent it: {money(listing.rent_price_monthly)} / month</strong>
          <ul>
            <li>
              {minMonths}–{maxMonths} months
              {listing.rent_to_buy_enabled ? " (rent-to-buy: over 6 months you can buy it after month 6)" : ""}
            </li>
            <li>3+ months: 3 months upfront, last month always prepaid.</li>
            <li>Money is refunded if the appliance breaks.</li>
          </ul>
        </div>
      )}

      <div className="ld-actions">
        <button type="button" className="ld-btn primary" onClick={() => setMode("buy")}>
          <Icon name="cart" size={20} /> Buy Now
        </button>
        {rentable && (
          <button type="button" className="ld-btn purple" onClick={() => setMode("rent")}>
            <Icon name="calendar" size={20} /> Rent from {money(listing.rent_price_monthly)}/mo
          </button>
        )}
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
      {mode === "rent" && (
        <RentModal
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
