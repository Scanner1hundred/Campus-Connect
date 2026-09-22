"use client";

import { useState, useTransition } from "react";
import { reserveForBuyer } from "@/app/market/messages/actions";

// Dropdown of everyone who has messaged the seller about this listing,
// alphabetical by name — the seller picks one to reserve the item for,
// or clears the reservation. No price/offer involved.
export default function ReserveForBuyer({ listingId, reservedFor, messagers }) {
  const [selected, setSelected] = useState(reservedFor ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(null);

  function handleChange(e) {
    const buyerId = e.target.value || null;
    setSelected(e.target.value);
    setError(null);
    startTransition(async () => {
      const res = await reserveForBuyer({ listingId, buyerId });
      if (res?.error) setError(res.error);
    });
  }

  if (messagers.length === 0) {
    return (
      <div className="reserve-box reserve-box-empty">
        No one has messaged you about this listing yet.
      </div>
    );
  }

  return (
    <div className="reserve-box">
      <label htmlFor="reserve-select">Reserve for buyer</label>
      <select id="reserve-select" value={selected} onChange={handleChange} disabled={isPending}>
        <option value="">— Not reserved —</option>
        {messagers.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {error && <p className="msg-error">{error}</p>}
    </div>
  );
}
