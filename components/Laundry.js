'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import MarketHeader from '@/components/MarketHeader';
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
    hint: 'One slot, wash then dry. 90 minutes plus 15 to clear out.',
    steps: [
      { key: 'wash', label: 'Wash 45 min', min: 45 },
      { key: 'dry', label: 'Dry 45 min', min: 45 },
      { key: 'clear', label: 'Clear out 15', min: 15 },
    ],
  },
  wash: {
    label: 'Wash only',
    minutes: 60,
    hint: 'Washing only. 60 minutes plus 15 to clear out.',
    steps: [
      { key: 'wash', label: 'Wash 60 min', min: 60 },
      { key: 'clear', label: 'Clear out 15', min: 15 },
    ],
  },
  dry: {
    label: 'Dry only',
    minutes: 60,
    hint: 'Drying only. 60 minutes plus 15 to clear out.',
    steps: [
      { key: 'dry', label: 'Dry 60 min', min: 60 },
      { key: 'clear', label: 'Clear out 15', min: 15 },
    ],
  },
};

// PLACEHOLDER prices. Change these, or set a value to '' to hide it.
const PRICES = { both: 'R15.00', wash: 'R10.00', dry: 'R10.00' };

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
  const [now, setNow] = useState(() => new Date());

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
      .select('booking_id, slot_start, cycle')
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

  // wash-only and dry-only can't be split across one day
  const splitConflict = useMemo(() => {
    if (cycle === 'both') return null;
    const other = cycle === 'wash' ? 'dry' : 'wash';
    return mine.some((b) => dayOf(b.slot_start) === day && b.cycle === other) ? other : null;
  }, [mine, day, cycle]);

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

  async function confirmBooking() {
    if (!selectedStart || busy) return;
    setBusy(true);
    setNotice(null);
    const { error } = await supabase.rpc('book_laundry_slot', {
      p_slot_start: selectedStart.toISOString(),
      p_cycle: cycle,
    });
    setBusy(false);
    if (error) {
      setNotice({ type: 'error', text: error.message || 'Could not book that slot.' });
      loadAvail(); // the slot may have just filled up
      return;
    }
    setNotice({
      type: 'ok',
      text: `Booked for ${dayShort(day)}, ${hm(selectedStart)}. Please be out by ${hm(beOutBy)}.`,
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
      <MarketHeader displayName={displayName} backHref="/" backLabel="Back to home" />
      <div className="ln-wrap">
        <h1 className="ln-title">Laundry Booking</h1>

        <section className="ln-hero">
          <span className="ln-bubble ln-bubble-1" aria-hidden="true" />
          <span className="ln-bubble ln-bubble-2" aria-hidden="true" />
          <span className="ln-bubble ln-bubble-3" aria-hidden="true" />
          <span className="ln-bubble ln-bubble-4" aria-hidden="true" />
          <div className="ln-hero-text">
            <p className="ln-eyebrow">Campus laundry room</p>
            <h2 className="ln-headline">
              Fresh clothes,
              <br />
              <span>zero queueing.</span>
            </h2>
            <p className="ln-hero-sub">Book a slot, walk in, and your machines are waiting.</p>
            <span className="ln-pill">
              <span className="ln-pill-dot" />
              Walk-ups welcome when machines are free
            </span>
          </div>
          <svg className="ln-wave" viewBox="0 0 1200 46" preserveAspectRatio="none" aria-hidden="true">
            <path
              d="M0 26c150 22 300 22 450 0s300-22 450 0 225 16 300 8v12H0z"
              fill="#ffffff"
              fillOpacity="0.7"
            />
          </svg>
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
                    onClick={() => changeCycle(key)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="ln-cycle-hint">{cyc.hint}</p>
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

              {splitConflict && (
                <div className="ln-notice is-info" role="status">
                  You already have a {splitConflict}-only booking on this day. To wash and dry on the same
                  day, choose Wash + Dry in one slot, or pick another day.
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
                    const disabled = passed || booked || left <= 0 || Boolean(splitConflict);

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

            <section className="ln-card" aria-label="My upcoming bookings">
              <h3 className="ln-section-title">My upcoming bookings</h3>
              {upcoming.length === 0 ? (
                <p className="ln-empty">Nothing booked yet. Pick a day and time above.</p>
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
                            {CYCLES[b.cycle].label}. Be out by {hm(b.out)}.
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
                              <button
                                type="button"
                                className="ln-link-btn is-plain"
                                onClick={() => setCancelId(null)}
                              >
                                Keep
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="ln-link-btn"
                              onClick={() => setCancelId(b.booking_id)}
                            >
                              Cancel
                            </button>
                          ))}
                      </li>
                    );
                  })}
                </ul>
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
                  {PRICES[cycle] && <span className="ln-only-mobile"> for {PRICES[cycle]}</span>}
                </p>

                <div className="ln-sum-extra">
                  <Timeline steps={cyc.steps} />
                  {PRICES[cycle] && (
                    <div className="ln-sum-row">
                      <span>Price</span>
                      <span className="ln-sum-price">{PRICES[cycle]}</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="ln-sum-empty">Pick a day and a time to see your booking here.</p>
            )}

            <button
              type="button"
              className="ln-confirm"
              disabled={!selectedStart || busy}
              onClick={confirmBooking}
            >
              {busy ? 'Booking…' : 'Confirm booking'}
            </button>
            <p className="ln-fine">
              Please be out by {beOutBy ? hm(beOutBy) : '15 minutes after your cycle ends'}. You can cancel up
              to 30 minutes before your slot. Walk-ups are welcome when machines are free (max 4 a day).
            </p>
          </aside>
        </div>
      </div>
    </main>
  );
}
