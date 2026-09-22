'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import CardPicker from '@/components/CardPicker';
import { money } from '@/lib/cards';
import '@/app/market/checkout.css';

// Laundry checkout (demo payments). Same saved_cards table, same
// CardPicker, and the same "DEMO-" payment reference pattern as the
// Marketplace's Buy flow (components/CheckoutModal.js) — card only,
// since there's no seller to hand cash to for a laundry slot.
export default function LaundryCheckout({ summary, cycle, amount, slotStart, onClose, onSuccess }) {
  const supabase = createClient();
  const pickerRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    setBusy(true);
    try {
      const cardId = await pickerRef.current.resolveCardId();
      const { data, error: rpcError } = await supabase.rpc('book_laundry_slot', {
        p_slot_start: slotStart.toISOString(),
        p_cycle: cycle,
        p_card_id: cardId,
      });
      if (rpcError) throw rpcError;
      const row = Array.isArray(data) ? data[0] : data;
      onSuccess(row);
    } catch (err) {
      console.error(err);
      setError(err?.message || 'Payment failed. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="co-overlay" role="dialog" aria-modal="true">
      <div className="co-modal">
        <div className="co-head">
          <h2>Checkout</h2>
          <button type="button" className="co-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <p className="co-demo">
          Demo payments only — no real money moves. Test card: <strong>4242 4242 4242 4242</strong>, any future
          expiry, any CVV.
        </p>

        <div className="co-item">
          <strong>{summary}</strong>
          <span>{money(amount)}</span>
        </div>

        <CardPicker ref={pickerRef} />

        {error && <p className="co-error">{error}</p>}

        <button type="button" className="co-pay" onClick={submit} disabled={busy}>
          {busy ? 'Processing…' : `Pay ${money(amount)}`}
        </button>
      </div>
    </div>
  );
}
