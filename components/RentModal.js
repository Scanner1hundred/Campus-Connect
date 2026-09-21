"use client"

import { useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import CardPicker from "@/components/CardPicker"
import { money } from "@/lib/cards"
import "@/app/market/checkout.css"

// How much rent will have been paid by the time month 6 is finished (for the buy-out estimate)
function rentPaidAfterMonth6(term) {
  const paid = new Set([1, 2, term])
  for (let k = 3; k <= term - 1; k++) if (k - 2 <= 6) paid.add(k)
  return paid.size
}

// RENT checkout (demo payments): term picker, plain-English payment schedule, saved card, consent.
export default function RentModal({ listing, onClose, onSuccess }) {
  const supabase = createClient()
  const pickerRef = useRef(null)

  const rent = Number(listing.rent_price_monthly || 0)
  const price = Number(listing.price || 0)
  const minMonths = listing.subcategories?.rent_min_months || 1
  const maxMonths = listing.rent_to_buy_enabled ? 10 : 6
  const options = []
  for (let m = minMonths; m <= maxMonths; m++) options.push(m)

  const [term, setTerm] = useState(Math.min(Math.max(3, minMonths), maxMonths))
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const upfront = term >= 3 ? rent * 3 : rent
  const laterMonths = Math.max(term - 3, 0)
  const isRentToBuy = listing.rent_to_buy_enabled && term > 6
  const buyoutEstimate = Math.max(price - rentPaidAfterMonth6(term) * rent, 0)

  async function submit() {
    setError("")
    if (!consent) return setError("Please tick the box to authorise the card charges.")
    setBusy(true)
    try {
      const cardId = await pickerRef.current.resolveCardId()
      const { data, error: rpcError } = await supabase.rpc("start_rental", {
        p_listing_id: listing.listing_id,
        p_term_months: term,
        p_card_id: cardId,
      })
      if (rpcError) throw rpcError
      onSuccess({ kind: "rent", id: data })
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
          <h2>Rent this item</h2>
          <button type="button" className="co-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <p className="co-demo">
          Demo payments only — no real money moves. Test card: <strong>4242 4242 4242 4242</strong>, any future
          expiry, any CVV.
        </p>

        <div className="co-item">
          <strong>{listing.title}</strong>
          <span>{money(rent)} / month</span>
        </div>

        <label className="co-field">
          Rental period
          <select value={term} onChange={(e) => setTerm(Number(e.target.value))}>
            {options.map((m) => (
              <option key={m} value={m}>
                {m} month{m === 1 ? "" : "s"}
                {m > 6 ? " (rent-to-buy)" : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="co-summary">
          <div className="co-line">
            <span>Due today</span>
            <strong>{money(upfront)}</strong>
          </div>
          <ul>
            {term >= 3 ? (
              <>
                <li>3 months upfront: covers month 1, month 2 and your final month (paid in advance).</li>
                {laterMonths > 0 ? (
                  <li>
                    Months 3–{term - 1}: {money(rent)} each, charged to your saved card one month before it&apos;s due.
                  </li>
                ) : (
                  <li>Nothing further to pay — the whole term is covered today.</li>
                )}
              </>
            ) : (
              <>
                <li>Month 1 is paid today.</li>
                {term === 2 && <li>Month 2 ({money(rent)}) is charged at the start of month 2.</li>}
              </>
            )}
            <li>Total over {term} month{term === 1 ? "" : "s"}: {money(rent * term)}</li>
            <li>The owner is paid each month&apos;s rent at the end of that month. If the appliance breaks, you get back the money that hasn&apos;t been paid out yet.</li>
            {isRentToBuy && (
              <li>
                Rent-to-buy: after month 6 you can buy it for {money(price)} minus the rent you&apos;ve paid (about{" "}
                {money(buyoutEstimate)}). Or just keep renting to the end of the term.
              </li>
            )}
          </ul>
        </div>

        <CardPicker ref={pickerRef} />

        <label className="co-consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            I authorise Campus Connect to charge my saved card for this rental as described above, until the rental
            period ends.
          </span>
        </label>

        {error && <p className="co-error">{error}</p>}

        <button type="button" className="co-pay purple" onClick={submit} disabled={busy}>
          {busy ? "Processing..." : `Pay ${money(upfront)} & start rental`}
        </button>
      </div>
    </div>
  )
}
