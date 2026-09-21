"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { money } from "@/lib/cards"
import "@/app/market/rentals.css"

const fmt = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })

const STATUS_LABEL = {
  active: "Active",
  completed: "Completed",
  bought: "Bought",
  refunded: "Refunded",
  cancelled: "Cancelled",
}

export default function MyRentals({ userId }) {
  const supabase = createClient()
  const [tab, setTab] = useState("renting") // "renting" | "rentedOut"
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState(null)

  async function load() {
    setError("")
    // Bring every ledger up to date first (charges due, pay-outs earned, finished rentals)
    await supabase.rpc("process_my_rentals")

    const { data, error: fetchError } = await supabase
      .from("rentals")
      .select("*, rental_charges(*), rental_payouts(*)")
      .or(`renter_id.eq.${userId},owner_id.eq.${userId}`)
      .order("created_at", { ascending: false })

    if (fetchError) {
      console.error(fetchError)
      setError("Unable to load your rentals.")
    }
    setRentals(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function skipMonth(rentalId) {
    setBusyId(rentalId)
    setError("")
    const { error: rpcError } = await supabase.rpc("demo_advance_rental", { p_rental_id: rentalId, p_days: 31 })
    if (rpcError) setError(rpcError.message)
    await load()
    setBusyId(null)
  }

  const renting = rentals.filter((r) => r.renter_id === userId)
  const rentedOut = rentals.filter((r) => r.owner_id === userId)
  const list = tab === "renting" ? renting : rentedOut

  return (
    <div className="rt-wrap">
      <div className="rt-head">
        <h1>My Rentals</h1>
        <p>Every payment in and out of your rentals. Prepaid money is held by Campus Connect and paid to the owner month by month.</p>
      </div>

      <div className="rt-tabs">
        <button type="button" className={tab === "renting" ? "rt-tab active" : "rt-tab"} onClick={() => setTab("renting")}>
          I&apos;m renting <em>{renting.length}</em>
        </button>
        <button type="button" className={tab === "rentedOut" ? "rt-tab active" : "rt-tab"} onClick={() => setTab("rentedOut")}>
          Rented out by me <em>{rentedOut.length}</em>
        </button>
      </div>

      {error && <p className="notice error">{error}</p>}
      {loading && <p className="rt-empty">Loading your rentals...</p>}
      {!loading && list.length === 0 && (
        <p className="rt-empty">
          {tab === "renting"
            ? "You aren't renting anything yet. Open a fridge, microwave, oven or fryer listing and choose Rent."
            : "None of your items are rented out right now."}
        </p>
      )}

      {list.map((r) => {
        const charges = [...(r.rental_charges || [])].sort((a, b) => a.rent_month - b.rent_month)
        const payouts = [...(r.rental_payouts || [])].sort((a, b) => a.rent_month - b.rent_month)
        const paid = charges.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0)
        const released = payouts.filter((p) => p.status === "released").reduce((s, p) => s + Number(p.amount), 0)
        const held = paid - released
        const demoDate = new Date(Date.now() + r.demo_offset_days * 86400000).toLocaleDateString("en-ZA", {
          day: "numeric", month: "short", year: "numeric",
        })
        const isRenter = r.renter_id === userId

        return (
          <article className="rt-card" key={r.rental_id}>
            <div className="rt-card-head">
              <div>
                <h2>{r.listing_title}</h2>
                <p>
                  {money(r.monthly_rent)}/month · {r.term_months} month{r.term_months === 1 ? "" : "s"} · started{" "}
                  {fmt(r.start_date)}
                  {r.rent_to_buy ? " · rent-to-buy" : ""}
                </p>
              </div>
              <span className={`rt-status rt-${r.status}`}>{STATUS_LABEL[r.status] || r.status}</span>
            </div>

            <div className="rt-stats">
              <div><small>{isRenter ? "You've paid" : "Renter has paid"}</small><strong>{money(paid)}</strong></div>
              <div><small>Held by Campus Connect</small><strong>{money(held)}</strong></div>
              <div><small>{isRenter ? "Paid out to owner" : "Paid out to you"}</small><strong>{money(released)}</strong></div>
            </div>

            <div className="rt-table-wrap">
              <table className="rt-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Rent due</th>
                    <th>{isRenter ? "Card charged" : "Renter charged"}</th>
                    <th>Owner paid</th>
                  </tr>
                </thead>
                <tbody>
                  {charges.filter((c) => c.kind !== "buyout").map((c) => {
                    const p = payouts.find((x) => x.rent_month === c.rent_month && x.kind === "rent")
                    return (
                      <tr key={c.charge_id}>
                        <td>{c.rent_month}</td>
                        <td>{fmt(c.period_start)}</td>
                        <td>
                          <span className={`rt-pill ${c.status}`}>{c.status}</span> {fmt(c.charge_date)}
                        </td>
                        <td>
                          {p ? (
                            <>
                              <span className={`rt-pill ${p.status}`}>{p.status}</span> {fmt(p.release_date)}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {r.status === "active" && isRenter && (
              <div className="rt-demo">
                <span>
                  Demo date: <strong>{demoDate}</strong>
                </span>
                <button type="button" onClick={() => skipMonth(r.rental_id)} disabled={busyId === r.rental_id}>
                  {busyId === r.rental_id ? "..." : "⏩ Skip 1 month (demo)"}
                </button>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}
