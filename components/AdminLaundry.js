'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { money } from '@/lib/cards';
import '@/app/laundry/admin/admin.css';

const TZ = 'Africa/Johannesburg';
const UTC_OFFSET = '+02:00';

const hmFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const ymdFormat = new Intl.DateTimeFormat('en-CA', { timeZone: TZ });
const hm = (date) => hmFormat.format(date);
const todayStr = () => ymdFormat.format(new Date());
const dayLong = (ymd) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

const CYCLE_LABEL = { both: 'Wash + Dry', wash: 'Wash only', dry: 'Dry only' };
const STATUS_LABEL = { confirmed: 'Confirmed', cancelled: 'Cancelled' };

export default function AdminLaundry() {
  const supabase = useMemo(() => createClient(), []);

  const [machines, setMachines] = useState([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('washer');
  const [machineBusy, setMachineBusy] = useState(false);
  const [machineError, setMachineError] = useState('');

  const [day, setDay] = useState(todayStr());
  const [bookings, setBookings] = useState([]);
  const [names, setNames] = useState({});
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [bookingsError, setBookingsError] = useState('');

  const loadMachines = useCallback(async () => {
    setMachinesLoading(true);
    const { data, error } = await supabase
      .from('laundry_machines')
      .select('machine_id, name, machine_type, active')
      .order('machine_type', { ascending: true })
      .order('name', { ascending: true });
    if (error) setMachineError(error.message || 'Could not load machines.');
    setMachines(data || []);
    setMachinesLoading(false);
  }, [supabase]);

  const loadBookings = useCallback(
    async (forDay) => {
      setBookingsLoading(true);
      setBookingsError('');
      const start = `${forDay}T00:00:00${UTC_OFFSET}`;
      const end = `${forDay}T23:59:59${UTC_OFFSET}`;
      const { data, error } = await supabase
        .from('laundry_bookings')
        .select('booking_id, user_id, slot_start, cycle, amount, payment_reference, status')
        .gte('slot_start', start)
        .lte('slot_start', end)
        .order('slot_start', { ascending: true });

      if (error) {
        setBookingsError(error.message || 'Could not load bookings.');
        setBookings([]);
        setBookingsLoading(false);
        return;
      }

      setBookings(data || []);

      const ids = [...new Set((data || []).map((b) => b.user_id))];
      if (ids.length) {
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('id, full_name')
          .in('id', ids);
        setNames(Object.fromEntries((profiles || []).map((p) => [p.id, p.full_name])));
      } else {
        setNames({});
      }
      setBookingsLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    loadMachines();
  }, [loadMachines]);

  useEffect(() => {
    loadBookings(day);
  }, [day, loadBookings]);

  const capacity = useMemo(() => {
    const active = (type) => machines.filter((m) => m.machine_type === type && m.active).length;
    const washers = active('washer');
    const dryers = active('dryer');
    return {
      washers,
      dryers,
      bookableWashers: Math.max(washers - 1, 0),
      bookableDryers: Math.max(dryers - 1, 0),
    };
  }, [machines]);

  async function addMachine(e) {
    e.preventDefault();
    if (!newName.trim() || machineBusy) return;
    setMachineBusy(true);
    setMachineError('');
    const { error } = await supabase
      .from('laundry_machines')
      .insert({ name: newName.trim(), machine_type: newType, active: true });
    setMachineBusy(false);
    if (error) {
      setMachineError(error.message || 'Could not add that machine.');
      return;
    }
    setNewName('');
    loadMachines();
  }

  async function toggleActive(machine) {
    setMachineError('');
    const { error } = await supabase
      .from('laundry_machines')
      .update({ active: !machine.active })
      .eq('machine_id', machine.machine_id);
    if (error) setMachineError(error.message || 'Could not update that machine.');
    loadMachines();
  }

  async function removeMachine(machine) {
    if (!window.confirm(`Remove ${machine.name}? This can't be undone.`)) return;
    setMachineError('');
    const { error } = await supabase.from('laundry_machines').delete().eq('machine_id', machine.machine_id);
    if (error) setMachineError(error.message || 'Could not remove that machine.');
    loadMachines();
  }

  const confirmedToday = bookings.filter((b) => b.status === 'confirmed');
  const cancelledToday = bookings.filter((b) => b.status !== 'confirmed');

  return (
    <div className="la-wrap">
      <div className="la-head">
        <h1>Laundry admin</h1>
        <p>Add or take machines offline, and look up who's booked in on a given day.</p>
      </div>

      <section className="la-card">
        <h2>Machines</h2>
        <p className="la-cap">
          Bookable per slot right now: <strong>{capacity.bookableWashers} washer</strong>
          {capacity.bookableWashers === 1 ? '' : 's'} (of {capacity.washers} active),{' '}
          <strong>{capacity.bookableDryers} dryer</strong>
          {capacity.bookableDryers === 1 ? '' : 's'} (of {capacity.dryers} active) — one of each is always
          held back as a reserve.
        </p>

        {machineError && <p className="la-error">{machineError}</p>}

        {machinesLoading ? (
          <p className="la-empty">Loading machines…</p>
        ) : machines.length === 0 ? (
          <p className="la-empty">No machines yet — add one below.</p>
        ) : (
          <ul className="la-machine-list">
            {machines.map((m) => (
              <li key={m.machine_id} className="la-machine">
                <span className={`la-dot ${m.active ? 'is-on' : 'is-off'}`} aria-hidden="true" />
                <span className="la-machine-name">{m.name}</span>
                <span className="la-machine-type">{m.machine_type === 'washer' ? 'Washer' : 'Dryer'}</span>
                <span className="la-machine-status">{m.active ? 'Active' : 'Offline'}</span>
                <button type="button" className="la-btn outline" onClick={() => toggleActive(m)}>
                  {m.active ? 'Take offline' : 'Bring back online'}
                </button>
                <button type="button" className="la-btn danger" onClick={() => removeMachine(m)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="la-add-form" onSubmit={addMachine}>
          <input
            type="text"
            className="la-input"
            placeholder="Machine name, e.g. Washer 6"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={60}
          />
          <select className="la-select" value={newType} onChange={(e) => setNewType(e.target.value)}>
            <option value="washer">Washer</option>
            <option value="dryer">Dryer</option>
          </select>
          <button type="submit" className="la-btn primary" disabled={machineBusy || !newName.trim()}>
            {machineBusy ? 'Adding…' : 'Add machine'}
          </button>
        </form>
      </section>

      <section className="la-card">
        <h2>Bookings by day</h2>
        <div className="la-day-row">
          <label htmlFor="la-day" className="la-day-label">
            {dayLong(day)}
          </label>
          <input
            id="la-day"
            type="date"
            className="la-date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>

        {bookingsError && <p className="la-error">{bookingsError}</p>}
        {bookingsLoading ? (
          <p className="la-empty">Loading bookings…</p>
        ) : bookings.length === 0 ? (
          <p className="la-empty">No bookings for this day.</p>
        ) : (
          <>
            <h3 className="la-section">Confirmed ({confirmedToday.length})</h3>
            {confirmedToday.length === 0 ? (
              <p className="la-empty">None.</p>
            ) : (
              <table className="la-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Student</th>
                    <th>Cycle</th>
                    <th>Paid</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {confirmedToday.map((b) => (
                    <tr key={b.booking_id}>
                      <td>{hm(new Date(b.slot_start))}</td>
                      <td>{names[b.user_id] || 'Campus user'}</td>
                      <td>{CYCLE_LABEL[b.cycle] || b.cycle}</td>
                      <td>{money(b.amount)}</td>
                      <td className="la-ref">{b.payment_reference}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {cancelledToday.length > 0 && (
              <>
                <h3 className="la-section">Cancelled ({cancelledToday.length})</h3>
                <table className="la-table is-muted">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Student</th>
                      <th>Cycle</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cancelledToday.map((b) => (
                      <tr key={b.booking_id}>
                        <td>{hm(new Date(b.slot_start))}</td>
                        <td>{names[b.user_id] || 'Campus user'}</td>
                        <td>{CYCLE_LABEL[b.cycle] || b.cycle}</td>
                        <td>{STATUS_LABEL[b.status] || b.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
