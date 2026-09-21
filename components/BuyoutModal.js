"use client"

import { useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import CardPicker from "@/components/CardPicker"
import { money } from "@/lib/cards"
import "@/app/market/checkout.css"

// Rent-to-buy: buy-out price = asking price - rent already paid (demo payments).
export default function BuyoutModal({ rental, paid, onClose, onDone }) {
  const supabase = createClient()
  const pickerRef = useRef(null)
  const price = Number(rental.listing_price)
  const balance = Math.max(price - paid, 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  async function submit() {
    setError("")
    setBusy(true)
    try {
      const cardId = balance > 0 ? await pickerRef.current.resolveCardId() : null
      const { error: rpcError } = await supabase.rpc("buyout_rental", {
        p_rental_id: rental.rental_id,
        p_card_id: cardId,
      })
      if (rpcError) throw rpcError
      onDone()
    } catch (err) {
      console.error(err)
      setError(err?.message || "Could not complete the buy-out. Please try again.")
      setBusy(false)
    }
  }

  return (
    <div className="co-overlay" role="dialog" aria-modal="true">
      <div className="co-modal">
        <div className="co-head">
          <h2>Buy it now</h2>
          <button type="button" className="co-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <p className="co-demo">Demo payments only — no real money moves. Test card: <strong>4242 4242 4242 4242</strong>.</p>

        <div className="co-item">
          <strong>{rental.listing_title}</strong>
          <span>{money(price)}</span>
        </div>

        <div className="co-summary">
          <div className="co-line"><span>Asking price</span><strong>{money(price)}</strong></div>
          <div className="co-line"><span>Rent you&apos;ve already paid</span><strong>− {money(Math.min(paid, price))}</strong></div>
          <div className="co-line" style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid #ddd3fb" }}>
            <span>You pay now</span><strong>{money(balance)}</strong>
          </div>
          <ul>
            <li>The rental ends and the item is yours. The owner receives the full asking price in total.</li>
          </ul>
        </div>

        {balance > 0 && <CardPicker ref={pickerRef} />}
        {error && <p className="co-error">{error}</p>}

        <button type="button" className="co-pay purple" onClick={submit} disabled={busy}>
          {busy ? "Processing..." : balance > 0 ? `Pay ${money(balance)} & buy` : "Complete purchase"}
        </button>
      </div>
    </div>
  )
}
