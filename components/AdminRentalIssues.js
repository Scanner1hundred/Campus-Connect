"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { money } from "@/lib/cards"
import "@/app/market/rentals.css"

const STATUS = {
  reported: "Awaiting decision",
  approved: "Approved (refunded)",
  rejected: "Rejected",
  auto_refunded: "Auto-refunded (small appliance)",
}

// Admin only (the page checks the role, and the database functions check it again).
export default function AdminRentalIssues() {
  const supabase = createClient()
  const [issues, setIssues] = useState([])
  const [names, setNames] = useState({})
  const [notes, setNotes] = useState({})
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState("")

  async function load() {
    const { data, error: fetchError } = await supabase
      .from("rental_issues")
      .select("*, rentals(listing_title, monthly_rent, renter_id, owner_id), rental_refunds(amount)")
      .order("created_at", { ascending: false })

    if (fetchError) {
      console.error(fetchError)
      setError("Unable to load reports.")
    }
    setIssues(data || [])

    const ids = new Set()
    for (const i of data || []) {
      if (i.rentals?.renter_id) ids.add(i.rentals.renter_id)
      if (i.rentals?.owner_id) ids.add(i.rentals.owner_id)
    }
    if (ids.size) {
      const { data: profiles } = await supabase.from("public_profiles").select("id, full_name").in("id", [...ids])
      setNames(Object.fromEntries((profiles || []).map((p) => [p.id, p.full_name])))
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function decide(issueId, approve) {
    setError("")
    setBusyId(issueId)
    const { error: rpcError } = await supabase.rpc("resolve_rental_issue", {
      p_issue_id: issueId,
      p_approve: approve,
      p_note: notes[issueId] || "",
    })
    if (rpcError) setError(rpcError.message)
    await load()
    setBusyId(null)
  }

  const open = issues.filter((i) => i.status === "reported")
  const closed = issues.filter((i) => i.status !== "reported")
  const nameOf = (id) => names[id] || "Campus user"

  function renderCard(i, actionable) {
    return (
      <article className="rt-card" key={i.issue_id}>
        <div className="rt-card-head">
          <div>
            <h2>{i.rentals?.listing_title || "Rented item"}</h2>
            <p>
              Renter: {nameOf(i.rentals?.renter_id)} · Owner: {nameOf(i.rentals?.owner_id)} ·{" "}
              {money(i.rentals?.monthly_rent)}/month · {i.item_type === "fridge" ? "Fridge/freezer" : "Small appliance"}
            </p>
          </div>
          <span className={`rt-status rt-${i.status === "reported" ? "active" : i.status === "rejected" ? "cancelled" : "refunded"}`}>
            {STATUS[i.status]}
          </span>
        </div>

        <div className={`rt-issue ${i.status}`}>“{i.description}”</div>

        {i.repairman_note && <p className="rt-note">Repairman/admin note: “{i.repairman_note}”</p>}
        {i.rental_refunds?.length > 0 && (
          <p className="rt-note">Refunded: {money(i.rental_refunds.reduce((s, x) => s + Number(x.amount), 0))}</p>
        )}

        {actionable && (
          <>
            <label className="rt-label" htmlFor={`note-${i.issue_id}`}>Repairman&apos;s findings (required)</label>
            <textarea
              id={`note-${i.issue_id}`}
              className="rt-textarea"
              rows="2"
              value={notes[i.issue_id] || ""}
              onChange={(e) => setNotes({ ...notes, [i.issue_id]: e.target.value })}
              placeholder="e.g. Compressor failed, not repairable → refund"
            />
            <div className="rt-actions">
              <button type="button" className="rt-btn danger" disabled={busyId === i.issue_id} onClick={() => decide(i.issue_id, true)}>
                Approve refund
              </button>
              <button type="button" className="rt-btn outline" disabled={busyId === i.issue_id} onClick={() => decide(i.issue_id, false)}>
                Reject — item works / repaired
              </button>
            </div>
          </>
        )}
      </article>
    )
  }

  return (
    <div className="rt-wrap">
      <div className="rt-head">
        <h1>Breakage reports</h1>
        <p>
          Fridges and freezers are inspected by a repairman first. Approve to refund the renter everything not yet paid
          out to the owner, or reject to let the rental carry on.
        </p>
      </div>

      {error && <p className="notice error">{error}</p>}
      {loading && <p className="rt-empty">Loading...</p>}
      {!loading && issues.length === 0 && <p className="rt-empty">No breakage reports yet.</p>}

      {open.length > 0 && <h3 className="rt-section">Awaiting a decision ({open.length})</h3>}
      {open.map((i) => renderCard(i, true))}

      {closed.length > 0 && <h3 className="rt-section">Resolved</h3>}
      {closed.map((i) => renderCard(i, false))}
    </div>
  )
}
