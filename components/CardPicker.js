"use client"

import { forwardRef, useEffect, useImperativeHandle, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { detectBrand, formatCardNumber, formatExpiry, luhnValid, parseExpiry } from "@/lib/cards"
import "@/app/market/checkout.css"

/**
 * Saved-card chooser + "add a new card" form (DEMO payments).
 * The parent calls  ref.current.resolveCardId()  when the user confirms:
 * it returns the card_id to use (saving a new card first if needed) or throws Error(message).
 * Only brand / last 4 / expiry are saved. Number and CVV never leave this component.
 */
const CardPicker = forwardRef(function CardPicker(_props, ref) {
  const supabase = createClient()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [cardId, setCardId] = useState("")
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ number: "", name: "", expiry: "", cvv: "" })

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("saved_cards").select("*").order("created_at", { ascending: false })
      setCards(data || [])
      if (data?.length) setCardId(data[0].card_id)
      else setAdding(true)
      setLoading(false)
    }
    load()
  }, [])

  function validate() {
    if (!luhnValid(form.number)) return "That card number doesn't look valid."
    if (!form.name.trim()) return "Enter the name on the card."
    if (!parseExpiry(form.expiry)) return "Enter a valid future expiry date (MM/YY)."
    if (!/^\d{3,4}$/.test(form.cvv)) return "Enter the 3 or 4 digit CVV."
    return null
  }

  useImperativeHandle(
    ref,
    () => ({
      async resolveCardId() {
        if (!adding) {
          if (!cardId) throw new Error("Please choose a card.")
          return cardId
        }
        const problem = validate()
        if (problem) throw new Error(problem)

        const exp = parseExpiry(form.expiry)
        const digits = form.number.replace(/\D/g, "")
        const {
          data: { user },
        } = await supabase.auth.getUser()

        const { data, error } = await supabase
          .from("saved_cards")
          .insert({
            user_id: user.id,
            brand: detectBrand(digits),
            last4: digits.slice(-4),
            exp_month: exp.month,
            exp_year: exp.year,
            holder_name: form.name.trim(),
          })
          .select()
          .single()
        if (error) throw error
        return data.card_id
      },
    }),
    [adding, cardId, form]
  )

  if (loading) return <p className="co-hint">Loading your cards...</p>

  return (
    <div className="co-cards">
      {cards.map((c) => (
        <label key={c.card_id} className={!adding && cardId === c.card_id ? "co-card selected" : "co-card"}>
          <input
            type="radio"
            name="card"
            checked={!adding && cardId === c.card_id}
            onChange={() => {
              setAdding(false)
              setCardId(c.card_id)
            }}
          />
          <span>
            {c.brand} •••• {c.last4}
          </span>
          <em>
            Exp {String(c.exp_month).padStart(2, "0")}/{String(c.exp_year).slice(-2)}
          </em>
        </label>
      ))}

      {!adding && (
        <button type="button" className="co-link" onClick={() => setAdding(true)}>
          + Add a new card
        </button>
      )}

      {adding && (
        <div className="co-newcard">
          <label className="co-field">
            Card number
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="4242 4242 4242 4242"
              value={form.number}
              onChange={(e) => setForm({ ...form, number: formatCardNumber(e.target.value) })}
            />
          </label>
          <label className="co-field">
            Name on card
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <div className="co-row">
            <label className="co-field">
              Expiry
              <input
                inputMode="numeric"
                placeholder="MM/YY"
                value={form.expiry}
                onChange={(e) => setForm({ ...form, expiry: formatExpiry(e.target.value) })}
              />
            </label>
            <label className="co-field">
              CVV
              <input
                inputMode="numeric"
                type="password"
                autoComplete="off"
                maxLength={4}
                value={form.cvv}
                onChange={(e) => setForm({ ...form, cvv: e.target.value.replace(/\D/g, "") })}
              />
            </label>
          </div>
          <p className="co-hint">
            Only the card brand, last 4 digits and expiry are saved to your account. The full number and CVV are never
            stored.
          </p>
          {cards.length > 0 && (
            <button type="button" className="co-link" onClick={() => setAdding(false)}>
              Use a saved card instead
            </button>
          )}
        </div>
      )}
    </div>
  )
})

export default CardPicker
