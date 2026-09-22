'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { money } from '@/lib/cards';
import LaundryCheckout from '@/components/LaundryCheckout';
import '@/app/laundry/laundry.css';

/* ------------------------------------------------------------------ */
/* Rules (keep in sync with supabase/laundry.sql)                      */
/* ------------------------------------------------------------------ */
const TZ = 'Africa/Johannesburg';
const UTC_OFFSET = '+02:00'; // South Africa has no daylight saving
const SLOT_STARTS = ['06:00', '07:45', '09:30', '11:15', '13:00', '14:45', '16:30', '18:15', '20:00'];
const GRACE_MIN = 15;
const CANCEL_CUTOFF_MIN = 30;
const DAYS_AHEAD = 7;

const CYCLES = {
  both: {
    label: 'Wash + Dry',
    minutes: 90,
    hint: 'One slot, wash then dry. R50 — R10 cheaper than booking wash and dry separately.',
    steps: [
      { key: 'wash', label: 'Wash 45 min', min: 45 },
      { key: 'dry', label: 'Dry 45 min', min: 45 },
      { key: 'clear', label: 'Clear out 15', min: 15 },
    ],
  },
  wash: {
    label: 'Wash only',
    minutes: 60,
    hint: 'Washing only. R30, and counts as 1 of your 2 cycles for the day.',
    steps: [
      { key: 'wash', label: 'Wash 60 min', min: 60 },
      { key: 'clear', label: 'Clear out 15', min: 15 },
    ],
  },
  dry: {
    label: 'Dry only',
    minutes: 60,
    hint: 'Drying only. R30, and counts as 1 of your 2 cycles for the day.',
    steps: [
      { key: 'dry', label: 'Dry 60 min', min: 60 },
      { key: 'clear', label: 'Clear out 15', min: 15 },
    ],
  },
};

// Real (demo) prices — charged via the saved-card checkout, same as Marketplace Buy.
const PRICES = { both: 50, wash: 30, dry: 30 };
// How many of the day's 2 cycles each booking type uses.
const CYCLE_CREDIT = { both: 2, wash: 1, dry: 1 };
const DAILY_CREDIT_LIMIT = 2;

/* ------------------------------------------------------------------ */
/* Time helpers (everything is shown in campus time)                   */
/* ------------------------------------------------------------------ */
const hmFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const ymdFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });

const hm = (date) => hmFormat.format(date);
const addMin = (date, m) => new Date(date.getTime() + m * 60000);
const slotDate = (day, start) => new Date(`${day}T${start}:00${UTC_OFFSET}`);
const todayStr = () => ymdFormat.format(new Date());
const dayOf = (isoOrDate) => ymdFormat.format(new Date(isoOrDate));

function addDays(ymd, n) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const dayName = (ymd) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });
const dayNum = (ymd) => Number(ymd.slice(8, 10));
const dayLong = (ymd) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
const dayShort = (ymd) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */
function BrandLogo() {
  // Same two-circle mark as MarketShell/MarketHeader's brand.
  return (
    <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="12" r="7" />
      <circle cx="15" cy="12" r="7" />
    </svg>
  );
}

function MachineIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="2.5" width="16" height="19" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="13.5" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8" cy="6" r="0.9" fill="currentColor" />
      <circle cx="11" cy="6" r="0.9" fill="currentColor" />
      <path d="M9.6 13.6c.8-.9 1.6.9 2.4 0s1.6.9 2.4 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function Timeline({ steps }) {
  return (
    <div>
      <div className="ln-bar" role="img" aria-label={steps.map((s) => s.label).join(', ')}>
        {steps.map((s) => (
          <div key={s.key} className={`ln-bar-seg is-${s.key}`} style={{ flex: s.min }} />
        ))}
      </div>
      <div className="ln-bar-labels">
        {steps.map((s) => (
          <span key={s.key} style={{ flex: s.min }}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main component                                                      */
/* ------------------------------------------------------------------ */
export default function Laundry({ displayName = '' }) {
  const supabase = useMemo(() => createClient(), []);

  const [cycle, setCycle] = useState('both');
  const [day, setDay] = useState(todayStr());
  const [avail, setAvail] = useState([]);
  const [loadingAvail, setLoadingAvail] = useState(true);
  const [mine, setMine] = useState([]);
  const [selected, setSelected] = useState(null); // 'HH:MM'
  const [notice, setNotice] = useState(null); // { type: 'error' | 'ok' | 'info', text }
  const [busy, setBusy] = useState(false);
  const [cancelId, setCancelId] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const pathname = usePathname();

  const availReq = useRef(0);

  // tick once a minute so "already started" slots lock themselves
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const days = useMemo(() => {
    const start = todayStr();
    return Array.from({ length: DAYS_AHEAD }, (_, i) => addDays(start, i));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now.toDateString()]);

  /* ---- data loading ---- */
  const loadAvail = useCallback(async () => {
    const id = ++availReq.current;
    setLoadingAvail(true);
    const { data, error } = await supabase.rpc('laundry_availability', { p_day: day });
    if (id !== availReq.current) return; // a newer request replaced this one
    if (error) {
      setAvail([]);
      setNotice({ type: 'error', text: error.message || 'Could not load availability.' });
    } else {
      setAvail(data || []);
    }
    setLoadingAvail(false);
  }, [supabase, day]);

  const loadMine = useCallback(async () => {
    const { data, error } = await supabase
      .from('laundry_bookings')
      .select('booking_id, slot_start, cycle, amount')
      .eq('status', 'confirmed')
      .gte('slot_start', `${todayStr()}T00:00:00${UTC_OFFSET}`)
      .order('slot_start', { ascending: true });
    if (!error) setMine(data || []);
  }, [supabase]);

  useEffect(() => {
    loadAvail();
  }, [loadAvail]);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  /* ---- derived state ---- */
  const availByStart = useMemo(() => {
    const map = {};
    for (const row of avail) map[hm(new Date(row.slot_start))] = row;
    return map;
  }, [avail]);

  const mineByStart = useMemo(() => {
    const map = {};
    for (const b of mine) {
      if (dayOf(b.slot_start) === day) map[hm(new Date(b.slot_start))] = b;
    }
    return map;
  }, [mine, day]);

  // Max 2 cycles a day (any mix of wash/dry/both); a "both" booking uses 2 by itself.
  const creditsUsedToday = useMemo(
    () =>
      mine
        .filter((b) => dayOf(b.slot_start) === day)
        .reduce((sum, b) => sum + CYCLE_CREDIT[b.cycle], 0),
    [mine, day]
  );
  const creditsLeftToday = DAILY_CREDIT_LIMIT - creditsUsedToday;
  const cycleNeedsMoreThanLeft = CYCLE_CREDIT[cycle] > creditsLeftToday;

  const leftFor = (row) => {
    if (!row) return 0;
    if (cycle === 'wash') return row.washers_left;
    if (cycle === 'dry') return row.dryers_left;
    return Math.min(row.washers_left, row.dryers_left);
  };

  const cyc = CYCLES[cycle];
  const selectedStart = selected ? slotDate(day, selected) : null;
  const selectedEnd = selectedStart ? addMin(selectedStart, cyc.minutes) : null;
  const beOutBy = selectedEnd ? addMin(selectedEnd, GRACE_MIN) : null;

  const upcoming = useMemo(
    () =>
      mine
        .map((b) => {
          const start = new Date(b.slot_start);
          const end = addMin(start, CYCLES[b.cycle].minutes);
          return { ...b, start, end, out: addMin(end, GRACE_MIN) };
        })
        .filter((b) => b.out > now),
    [mine, now]
  );

  /* ---- actions ---- */
  function changeCycle(next) {
    setCycle(next);
    setSelected(null);
    setNotice(null);
  }

  function changeDay(next) {
    setDay(next);
    setSelected(null);
    setNotice(null);
  }

  function openCheckout() {
    if (!selectedStart || cycleNeedsMoreThanLeft) return;
    setNotice(null);
    setCheckoutOpen(true);
  }

  function closeCheckout() {
    setCheckoutOpen(false);
    loadAvail(); // in case the slot changed while the modal was open
  }

  function handlePaid(result) {
    setCheckoutOpen(false);
    setNotice({
      type: 'ok',
      text: `Paid ${money(result?.amount ?? PRICES[cycle])} — booked for ${dayShort(day)}, ${hm(selectedStart)}. Please be out by ${hm(beOutBy)}. Reference ${result?.payment_reference || ''}.`,
    });
    setSelected(null);
    loadAvail();
    loadMine();
  }

  async function cancelBooking(id) {
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.rpc('cancel_laundry_booking', { p_booking_id: id });
    setBusy(false);
    setCancelId(null);
    if (error) {
      setNotice({ type: 'error', text: error.message || 'Could not cancel that booking.' });
      return;
    }
    setNotice({ type: 'ok', text: 'Booking cancelled.' });
    loadAvail();
    loadMine();
  }

  /* ---- render ---- */
  return (
    <main className="ln-page">
      {/* Marketplace shell's header, trimmed to brand + profile — no search bar, no sidebar. */}
      <header className="ms-header">
        <Link href="/" className="ms-brand">
          <BrandLogo />
          <span className="ms-brand-text">Campus Connect</span>
        </Link>
        <Link href={`/profile?from=${encodeURIComponent(pathname)}`} className="ms-user">
          <span className="ms-avatar" aria-hidden="true">
            {(displayName || '?').trim().charAt(0).toUpperCase()}
          </span>
          <span className="ms-user-name">{displayName}</span>
        </Link>
      </header>

      <div className="ln-wrap">
        <h1 className="ln-title">Laundry Booking</h1>

        <section className="ln-card" aria-label="My upcoming bookings">
          <h3 className="ln-section-title">My upcoming bookings</h3>
          {upcoming.length === 0 ? (
            <p className="ln-empty">Nothing booked yet. Pick a day and time below.</p>
          ) : (
            <ul className="ln-mine-list">
              {upcoming.map((b) => {
                const canCancel = b.start.getTime() - CANCEL_CUTOFF_MIN * 60000 > now.getTime();
                return (
                  <li key={b.booking_id} className="ln-mine">
                    <span className="ln-mine-icon">
                      <MachineIcon />
                    </span>
                    <div className="ln-mine-body">
                      <p className="ln-mine-when">
                        {dayShort(dayOf(b.start))}, {hm(b.start)} – {hm(b.end)}
                      </p>
                      <p className="ln-mine-meta">
                        {CYCLES[b.cycle].label} · {money(b.amount ?? PRICES[b.cycle])}. Be out by {hm(b.out)}.
                      </p>
                    </div>
                    {canCancel &&
                      (cancelId === b.booking_id ? (
                        <>
                          <button
                            type="button"
                            className="ln-link-btn"
                            disabled={busy}
                            onClick={() => cancelBooking(b.booking_id)}
                          >
                            Yes, cancel
                          </button>
                          <button type="button" className="ln-link-btn is-plain" onClick={() => setCancelId(null)}>
                            Keep
                          </button>
                        </>
                      ) : (
                        <button type="button" className="ln-link-btn" onClick={() => setCancelId(b.booking_id)}>
                          Cancel
                        </button>
                      ))}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="ln-layout">
          <div>
            <section className="ln-card" aria-label="Choose what to book">
              <div className="ln-seg" role="group" aria-label="What do you want to book?">
                {Object.entries(CYCLES).map(([key, c]) => (
                  <button
                    key={key}
                    type="button"
                    className={`ln-seg-btn${cycle === key ? ' is-active' : ''}`}
                    aria-pressed={cycle === key}
                    disabled={CYCLE_CREDIT[key] > creditsLeftToday}
                    onClick={() => changeCycle(key)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="ln-cycle-hint">{cyc.hint}</p>
              <p className="ln-cycle-hint">
                {creditsLeftToday > 0
                  ? `${creditsLeftToday} of ${DAILY_CREDIT_LIMIT} cycles left on ${dayShort(day)}.`
                  : `You've used your ${DAILY_CREDIT_LIMIT} cycles for ${dayShort(day)}.`}
              </p>
            </section>

            <section className="ln-card" aria-label="Choose a day">
              <h3 className="ln-section-title">Pick a day</h3>
              <div className="ln-days">
                {days.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`ln-day${d === day ? ' is-active' : ''}`}
                    aria-pressed={d === day}
                    onClick={() => changeDay(d)}
                  >
                    <span className="ln-day-name">{d === days[0] ? 'Today' : dayName(d)}</span>
                    <span className="ln-day-num">{dayNum(d)}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="ln-card" aria-label="Choose a time">
              <div className="ln-section-head">
                <h3 className="ln-section-title">Pick a time</h3>
                <span className="ln-section-note">{dayLong(day)}</span>
              </div>

              {notice && (
                <div
                  className={`ln-notice is-${notice.type}`}
                  role={notice.type === 'error' ? 'alert' : 'status'}
                >
                  {notice.text}
                </div>
              )}

              {cycleNeedsMoreThanLeft && (
                <div className="ln-notice is-info" role="status">
                  {creditsLeftToday <= 0
                    ? `You've already booked ${DAILY_CREDIT_LIMIT} cycles on ${dayShort(day)}. Pick another day, or cancel a booking above.`
                    : `Wash + Dry needs ${CYCLE_CREDIT.both} cycles, but you only have ${creditsLeftToday} left on ${dayShort(day)}. Choose Wash only or Dry only instead.`}
                </div>
              )}

              {loadingAvail ? (
                <div className="ln-slots" aria-busy="true">
                  {SLOT_STARTS.map((s) => (
                    <div key={s} className="ln-skeleton" />
                  ))}
                </div>
              ) : (
                <div className="ln-slots">
                  {SLOT_STARTS.map((start) => {
                    const startDate = slotDate(day, start);
                    const endDate = addMin(startDate, cyc.minutes);
                    const row = availByStart[start];
                    const left = leftFor(row);
                    const passed = startDate <= now;
                    const booked = Boolean(mineByStart[start]);
                    const isSelected = selected === start;
                    const disabled = passed || booked || left <= 0 || cycleNeedsMoreThanLeft;

                    let caption;
                    if (booked) caption = 'Your booking';
                    else if (passed) caption = 'Passed';
                    else if (left <= 0) caption = 'Full';
                    else caption = `${left} left`;

                    const cls = [
                      'ln-tile',
                      isSelected && 'is-selected',
                      booked && 'is-mine',
                      !disabled && left === 1 && 'is-low',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    return (
                      <button
                        key={start}
                        type="button"
                        className={cls}
                        disabled={disabled}
                        aria-pressed={isSelected}
                        onClick={() => setSelected(isSelected ? null : start)}
                      >
                        <span className="ln-tile-time">
                          {start} – {hm(endDate)}
                        </span>
                        <span className="ln-tile-cap">{caption}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="ln-summary" aria-label="Booking summary">
            <h3 className="ln-sum-title">Your booking</h3>
            {selectedStart ? (
              <>
                <p className="ln-sum-main">{dayLong(day)}</p>
                <p className="ln-sum-time">
                  {hm(selectedStart)} – {hm(selectedEnd)}
                </p>
                <p className="ln-sum-mode">
                  {cyc.label}
                  <span className="ln-only-mobile"> for {money(PRICES[cycle])}</span>
                </p>

                <div className="ln-sum-extra">
                  <Timeline steps={cyc.steps} />
                  <div className="ln-sum-row">
                    <span>Price</span>
                    <span className="ln-sum-price">{money(PRICES[cycle])}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="ln-sum-empty">Pick a day and a time to see your booking here.</p>
            )}

            <button
              type="button"
              className="ln-confirm"
              disabled={!selectedStart || cycleNeedsMoreThanLeft}
              onClick={openCheckout}
            >
              Continue to payment
            </button>
            <p className="ln-fine">
              Please be out by {beOutBy ? hm(beOutBy) : '15 minutes after your cycle ends'}. You can cancel up
              to 30 minutes before your slot for a full refund. Walk-ups are welcome when machines are free
              (max 4 a day).
            </p>
          </aside>
        </div>
      </div>

      {checkoutOpen && selectedStart && (
        <LaundryCheckout
          summary={`${cyc.label} · ${dayShort(day)}, ${hm(selectedStart)}–${hm(selectedEnd)}`}
          cycle={cycle}
          amount={PRICES[cycle]}
          slotStart={selectedStart}
          onClose={closeCheckout}
          onSuccess={handlePaid}
        />
      )}
    </main>
  );
}
