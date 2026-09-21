"use client"

import { useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import CardPicker from "@/components/CardPicker"
import { money } from "@/lib/cards"
import "@/app/market/checkout.css"

// BUY checkout (demo payments): pay by saved card, or cash on collection.
export default function CheckoutModal({ listing, onClose, onSuccess }) {
  const supabase = createClient()
  const pickerRef = useRef(null)
  const [method, setMethod] = useState("card") // "card" | "cash"
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    setError("")
    setBusy(true)
    try {
      const cardId = method === "card" ? await pickerRef.current.resolveCardId() : null

      const { data, error: rpcError } = await supabase.rpc("purchase_listing", {
        p_listing_id: listing.listing_id,
        p_method: method,
        p_card_id: cardId,
      })
      if (rpcError) throw rpcError
      onSuccess({ kind: "buy", id: data })
    } catch (err) {
      console.error(err)
      setError(err?.message || "Payment failed. Please try again.")
      setBusy(false)
    }
  }

  return (
    <div className="co-overlay" role="dialog" aria-modal="true">
      <div className="co-modal">
        <div className="co-head">
          <h2>Checkout</h2>
          <button type="button" className="co-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <p className="co-demo">
          Demo payments only — no real money moves. Test card: <strong>4242 4242 4242 4242</strong>, any future
          expiry, any CVV.
        </p>

        <div className="co-item">
          <strong>{listing.title}</strong>
          <span>{money(listing.price)}</span>
        </div>

        <div className="co-methods">
          <button type="button" className={method === "card" ? "co-chip active" : "co-chip"} onClick={() => setMethod("card")}>
            Pay by card
          </button>
          <button type="button" className={method === "cash" ? "co-chip active" : "co-chip"} onClick={() => setMethod("cash")}>
            Cash on collection
          </button>
        </div>

        {method === "card" && <CardPicker ref={pickerRef} />}
        {method === "cash" && (
          <p className="co-hint">You&apos;ll pay the seller in cash when you collect the item.</p>
        )}

        {error && <p className="co-error">{error}</p>}

        <button type="button" className="co-pay" onClick={submit} disabled={busy}>
          {busy ? "Processing..." : method === "cash" ? "Place order" : `Pay ${money(listing.price)}`}
        </button>
      </div>
    </div>
  )
}
