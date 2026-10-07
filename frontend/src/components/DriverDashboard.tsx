import { useState, useEffect } from 'react';
import {
  Bus, Play, Square, Wifi, WifiOff, CloudUpload, Navigation,
  CheckCircle2, SkipForward, ShieldAlert, X, MapPin,
} from 'lucide-react';
import { useTripTracker } from '../../hooks/useTripTracker';
import { startBackgroundTracking, stopBackgroundTracking } from '../services/nativeLocation';

interface Stop {
  id: number;
  name: string;
  sequence: number;
  alert_radius_meters: number;
  stopStatus?: 'PENDING' | 'ARRIVED' | 'SKIPPED';
}

interface Trip {
  id: number;
  route_name: string;
  vehicle_reg: string;
  status: 'SCHEDULED' | 'ACTIVE';
  started_at: string | null;
  stops: Stop[];
}

interface Props {
  token: string;
  driverName: string;
}

const SKIP_REASONS = [
  { value: 'CHILD_ABSENT', label: 'Student Absent / Parent Called' },
  { value: 'ROAD_BLOCKAGE', label: 'Road Blockage / Inaccessible' },
  { value: 'GUARDIAN_DIRECT_PICKUP', label: 'Direct Parent Pickup' },
  { value: 'SAFETY_CONCERN', label: 'Safety / Traffic Hazard' },
  { value: 'OTHER', label: 'Other Operational Decision' },
];

export default function DriverDashboard({ token, driverName }: Props) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [skipModalStop, setSkipModalStop] = useState<Stop | null>(null);
  const [skipReason, setSkipReason] = useState(SKIP_REASONS[0].value);
  const [skipNotes, setSkipNotes] = useState('');

  const { isOnline, bufferedCount, lastCoords, syncStatus, startTracking, stopTracking } =
    useTripTracker(activeTrip?.id ?? null, token);

  const fetchTrips = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/tracking/driver/trips/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: Trip[] = await res.json();
        const withStatus = data.map((t) => ({
          ...t,
          stops: t.stops.map((s) => ({ ...s, stopStatus: 'PENDING' as const })),
        }));
        setTrips(withStatus);
        const running = withStatus.find((t) => t.status === 'ACTIVE') ?? null;
        setActiveTrip(running);
        if (running) startTracking();
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrips(); }, []);

  const handleStart = async (trip: Trip) => {
    setActionLoading(true);
    try {
      const res = await fetch(
        `http://localhost:8000/api/tracking/driver/trips/${trip.id}/start/`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const updated = { ...trip, status: 'ACTIVE' as const, started_at: new Date().toISOString() };
        setActiveTrip(updated);
        setTrips((prev) => prev.map((t) => (t.id === trip.id ? updated : t)));
        startTracking();
        await startBackgroundTracking(trip.id);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleEnd = async () => {
    if (!activeTrip) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `http://localhost:8000/api/tracking/driver/trips/${activeTrip.id}/end/`,
        { method: 'POST', headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        stopTracking();
        await stopBackgroundTracking();
        setActiveTrip(null);
        setTrips((prev) => prev.filter((t) => t.id !== activeTrip.id));
      }
    } finally {
      setActionLoading(false);
    }
  };

  const updateStopStatus = (stopId: number, newStatus: 'ARRIVED' | 'SKIPPED') => {
    const update = (t: Trip) => ({
      ...t,
      stops: t.stops.map((s) => s.id === stopId ? { ...s, stopStatus: newStatus } : s),
    });
    setActiveTrip((prev) => prev ? update(prev) : prev);
    setTrips((prev) => prev.map(update));
  };

  const handleArrived = async (stop: Stop) => {
    if (!activeTrip) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `http://localhost:8000/api/tracking/driver/trips/${activeTrip.id}/stops/${stop.id}/action/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'ARRIVED' }),
        }
      );
      if (res.ok) updateStopStatus(stop.id, 'ARRIVED');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmSkip = async () => {
    if (!activeTrip || !skipModalStop) return;
    setActionLoading(true);
    try {
      const res = await fetch(
        `http://localhost:8000/api/tracking/driver/trips/${activeTrip.id}/stops/${skipModalStop.id}/action/`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ action: 'SKIPPED', reason: skipReason, notes: skipNotes }),
        }
      );
      if (res.ok) {
        updateStopStatus(skipModalStop.id, 'SKIPPED');
        setSkipModalStop(null);
        setSkipNotes('');
        setSkipReason(SKIP_REASONS[0].value);
      }
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-48 text-slate-400 text-sm">Loading trips…</div>;
  }

  return (
    <div className="space-y-4 pb-12">
      {/* Status card */}
      <div className={`rounded-2xl p-4 text-white ${activeTrip ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-slate-600 to-slate-700'}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-75">
              {activeTrip ? 'Trip Active' : 'No Active Trip'}
            </p>
            <p className="text-lg font-bold mt-0.5">
              {activeTrip ? activeTrip.route_name : `Hello, ${driverName.split(' ')[0]}`}
            </p>
            {activeTrip && <p className="text-xs opacity-75 mt-0.5">{activeTrip.vehicle_reg}</p>}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="flex items-center gap-1 text-xs font-medium">
              {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
              {isOnline ? 'Online' : 'Offline'}
            </span>
            {bufferedCount > 0 && (
              <span className="flex items-center gap-1 text-xs bg-white/20 px-2 py-0.5 rounded-full">
                <CloudUpload size={11} />{bufferedCount} buffered
              </span>
            )}
          </div>
        </div>

        {activeTrip && (
          <>
            <div className="text-xs opacity-80 mb-3 flex items-center gap-1.5">
              <Navigation size={11} />
              {syncStatus}
              {lastCoords && (
                <span className="ml-auto">
                  {lastCoords.lat.toFixed(5)}, {lastCoords.lng.toFixed(5)} · {lastCoords.time}
                </span>
              )}
            </div>
            <button
              onClick={handleEnd}
              disabled={actionLoading}
              className="w-full py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50"
            >
              <Square size={14} /> End Trip
            </button>
          </>
        )}
      </div>

      {/* Scheduled trips */}
      {trips.filter((t) => t.status === 'SCHEDULED').length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Scheduled Trips</p>
          {trips.filter((t) => t.status === 'SCHEDULED').map((trip) => (
            <div key={trip.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Bus size={16} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{trip.route_name}</p>
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                    <MapPin size={10} />{trip.vehicle_reg}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleStart(trip)}
                disabled={actionLoading || !!activeTrip}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Play size={12} /> Start
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Route stops for active trip */}
      {activeTrip && activeTrip.stops.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 pt-4 pb-2">Route Stops</p>
          <div className="divide-y divide-slate-50">
            {activeTrip.stops.map((stop) => {
              const resolved = stop.stopStatus === 'ARRIVED' || stop.stopStatus === 'SKIPPED';
              return (
                <div key={stop.id} className={`px-4 py-3 ${stop.stopStatus === 'SKIPPED' ? 'opacity-50' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[11px] font-bold text-slate-600 flex-shrink-0">
                        {stop.sequence}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{stop.name}</p>
                        <p className="text-[11px] text-slate-400">Radius: {stop.alert_radius_meters}m</p>
                      </div>
                    </div>
                    {stop.stopStatus === 'ARRIVED' && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                        <CheckCircle2 size={11} /> Arrived
                      </span>
                    )}
                    {stop.stopStatus === 'SKIPPED' && (
                      <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">Skipped</span>
                    )}
                  </div>
                  {!resolved && (
                    <div className="flex gap-2 mt-2.5">
                      <button
                        onClick={() => handleArrived(stop)}
                        disabled={actionLoading}
                        className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition disabled:opacity-40"
                      >
                        <CheckCircle2 size={13} /> Arrived
                      </button>
                      <button
                        onClick={() => { setSkipModalStop(stop); setSkipReason(SKIP_REASONS[0].value); }}
                        disabled={actionLoading}
                        className="px-3.5 py-1.5 border border-slate-200 text-slate-600 text-xs font-semibold rounded-lg flex items-center gap-1.5 hover:bg-slate-50 transition disabled:opacity-40"
                      >
                        <SkipForward size={13} /> Skip
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {trips.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Bus size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No trips assigned for today.</p>
        </div>
      )}

      {/* Skip modal */}
      {skipModalStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900">
                <ShieldAlert size={17} className="text-amber-500" />
                Skip Stop #{skipModalStop.sequence}
              </div>
              <button onClick={() => setSkipModalStop(null)} className="text-slate-400 hover:text-slate-600">
                <X size={17} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Reason for bypassing <span className="font-semibold text-slate-700">{skipModalStop.name}</span>:
            </p>
            <div className="space-y-1.5 mb-3">
              {SKIP_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition ${skipReason === r.value ? 'border-blue-500 bg-blue-50 text-blue-900 font-medium' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}
                >
                  <input type="radio" name="skip_reason" value={r.value} checked={skipReason === r.value} onChange={(e) => setSkipReason(e.target.value)} className="text-blue-600" />
                  {r.label}
                </label>
              ))}
            </div>
            <textarea
              placeholder="Optional notes…"
              value={skipNotes}
              onChange={(e) => setSkipNotes(e.target.value)}
              rows={2}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
              <button onClick={() => setSkipModalStop(null)} className="flex-1 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleConfirmSkip} disabled={actionLoading} className="flex-1 py-2 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-50">
                Confirm Skip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
