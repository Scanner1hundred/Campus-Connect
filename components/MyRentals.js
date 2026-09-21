"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import BuyoutModal from "@/components/BuyoutModal"
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

const ISSUE_TEXT = {
  reported: "Reported — waiting for the repairman's inspection and an admin decision. Payments are paused.",
  approved: "Approved — your unpaid balance was refunded.",
  rejected: "Rejected after inspection — the rental continues.",
  auto_refunded: "Small appliance — refunded automatically.",
}

export default function MyRentals({ userId, isAdmin = false }) {
  const supabase = createClient()
  const [tab, setTab] = useState("renting") // "renting" | "rentedOut"
  const [rentals, setRentals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [busyId, setBusyId] = useState(null)
  const [reportingId, setReportingId] = useState(null)
  const [reportText, setReportText] = useState("")
  const [buyout, setBuyout] = useState(null) // { rental, paid }

  async function load() {
    setError("")
    await supabase.rpc("process_my_rentals")

    const { data, error: fetchError } = await supabase
      .from("rentals")
      .select("*, rental_charges(*), rental_payouts(*), rental_issues(*), rental_refunds(*)")
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

  async function submitReport(rentalId) {
    setBusyId(rentalId)
    setError("")
    const { data, error: rpcError } = await supabase.rpc("report_breakage", {
      p_rental_id: rentalId,
      p_description: reportText,
    })
    if (rpcError) {
      setError(rpcError.message)
    } else {
      setReportingId(null)
      setReportText("")
    }
    await load()
    setBusyId(null)
    return data
  }

  const renting = rentals.filter((r) => r.renter_id === userId)
  const rentedOut = rentals.filter((r) => r.owner_id === userId)
  const list = tab === "renting" ? renting : rentedOut

  return (
    <div className="rt-wrap">
      <div className="rt-head">
        <h1>My Rentals</h1>
        <p>
          Every payment in and out of your rentals. Prepaid money is held by Campus Connect and paid to the owner
          month by month.
        </p>
        {isAdmin && (
          <Link href="/market/admin/rentals" className="rt-admin-link">
            Admin: review breakage reports →
          </Link>
        )}
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
        const issues = [...(r.rental_issues || [])].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        const refunded = (r.rental_refunds || []).reduce((s, x) => s + Number(x.amount), 0)

        const paid = charges.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0)
        const released = payouts.filter((p) => p.status === "released").reduce((s, p) => s + Number(p.amount), 0)
        const held = r.status === "active" ? paid - released : 0

        const demoNow = new Date(Date.now() + r.demo_offset_days * 86400000)
        const buyoutOpens = new Date(`${r.start_date}T00:00:00`)
        buyoutOpens.setMonth(buyoutOpens.getMonth() + 6)

        const isRenter = r.renter_id === userId
        const openIssue = issues.find((i) => i.status === "reported")
        const canReport = r.status === "active" && isRenter && !openIssue
        const canBuyout = r.status === "active" && isRenter && r.rent_to_buy && !openIssue && demoNow >= buyoutOpens

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

            {r.status === "refunded" && (
              <div className="rt-banner refund">
                {isRenter ? "You were refunded" : "The renter was refunded"} <strong>{money(refunded)}</strong> — the
                money that hadn&apos;t been paid out yet. The listing is now inactive; re-activate it from My Listings
                once it&apos;s repaired or replaced.
              </div>
            )}
            {r.status === "bought" && (
              <div className="rt-banner bought">Bought out — the item now belongs to the renter.</div>
            )}

            <div className="rt-stats">
              <div><small>{isRenter ? "You've paid" : "Renter has paid"}</small><strong>{money(paid)}</strong></div>
              <div><small>Held by Campus Connect</small><strong>{money(held)}</strong></div>
              <div><small>{isRenter ? "Paid out to owner" : "Paid out to you"}</small><strong>{money(released)}</strong></div>
            </div>

            {issues.map((i) => (
              <div className={`rt-issue ${i.status}`} key={i.issue_id}>
                <strong>Problem report:</strong> “{i.description}”
                <br />
                {ISSUE_TEXT[i.status]}
                {i.repairman_note ? <> Repairman/admin note: “{i.repairman_note}”</> : null}
              </div>
            ))}

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

            {r.status === "active" && isRenter && r.rent_to_buy && !canBuyout && (
              <p className="rt-note">Rent-to-buy: you can buy this item once month 6 is finished ({fmt(buyoutOpens.toISOString().slice(0, 10))}).</p>
            )}

            {(canBuyout || canReport) && (
              <div className="rt-actions">
                {canBuyout && (
                  <button type="button" className="rt-btn purple" onClick={() => setBuyout({ rental: r, paid })}>
                    Buy it now — {money(Math.max(Number(r.listing_price) - paid, 0))}
                  </button>
                )}
                {canReport && reportingId !== r.rental_id && (
                  <button type="button" className="rt-btn outline" onClick={() => setReportingId(r.rental_id)}>
                    Report a problem
                  </button>
                )}
              </div>
            )}

            {reportingId === r.rental_id && (
              <div className="rt-report">
                <label htmlFor={`rep-${r.rental_id}`}>What went wrong?</label>
                <textarea
                  id={`rep-${r.rental_id}`}
                  rows="3"
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  placeholder="e.g. The compressor stopped cooling on Tuesday..."
                />
                <p className="rt-note">
                  Small appliances (microwave, oven, fryers) are refunded automatically. Fridges are inspected by a
                  repairman first, then approved by an admin — payments are paused while that happens. You get back
                  the money that hasn&apos;t been paid out to the owner yet.
                </p>
                <div className="rt-actions">
                  <button type="button" className="rt-btn danger" onClick={() => submitReport(r.rental_id)} disabled={busyId === r.rental_id}>
                    {busyId === r.rental_id ? "Sending..." : "Submit report"}
                  </button>
                  <button type="button" className="rt-btn outline" onClick={() => setReportingId(null)}>Cancel</button>
                </div>
              </div>
            )}

            {r.status === "active" && isRenter && (
              <div className="rt-demo">
                <span>
                  Demo date:{" "}
                  <strong>{demoNow.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" })}</strong>
                </span>
                <button type="button" onClick={() => skipMonth(r.rental_id)} disabled={busyId === r.rental_id}>
                  {busyId === r.rental_id ? "..." : "⏩ Skip 1 month (demo)"}
                </button>
              </div>
            )}
          </article>
        )
      })}

      {buyout && (
        <BuyoutModal
          rental={buyout.rental}
          paid={buyout.paid}
          onClose={() => setBuyout(null)}
          onDone={() => {
            setBuyout(null)
            load()
          }}
        />
      )}
    </div>
  )
}
