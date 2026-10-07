import { useEffect, useRef } from 'react';
import { MapPin, Bell, Navigation, Clock, Bus, CheckCircle2, Wifi, Shield, ChevronRight } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';

interface ActiveTripData {
  trip_id: number;
  vehicle_plate: string;
  started_at: string | null;
  approaching_alert_sent: boolean;
  last_known_location: {
    latitude: number;
    longitude: number;
    recorded_at: string;
    speed_kph: number;
  } | null;
}

interface StudentCard {
  id: number;
  admission_number: string;
  name: string;
  school_name: string;
  stop_name: string;
  stop_sequence: number;
  stop_location: { latitude: number; longitude: number } | null;
  active_trip: ActiveTripData | null;
}

interface Props {
  students: StudentCard[];
  lastUpdated: Date | null;
  loading?: boolean;
}

const busIcon = L.divIcon({
  className: '',
  html: `<div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1d4ed8);border:3px solid white;box-shadow:0 4px 12px rgba(37,99,235,0.5);display:flex;align-items:center;justify-content:center;">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="1" y="3" width="15" height="13" rx="2"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
    </svg>
  </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

const stopIcon = L.divIcon({
  className: '',
  html: `<div style="width:30px;height:30px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);border:3px solid white;box-shadow:0 3px 8px rgba(16,185,129,0.45);display:flex;align-items:center;justify-content:center;">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
  </div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

function MapRecenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const prev = useRef<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    if (!prev.current || prev.current.lat !== lat || prev.current.lng !== lng) {
      map.panTo([lat, lng], { animate: true, duration: 0.8 });
      prev.current = { lat, lng };
    }
  }, [lat, lng, map]);
  return null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
}

function formatElapsed(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// Avatar color based on name
function avatarColor(name: string) {
  const colors = [
    ['#dbeafe', '#1d4ed8'], ['#dcfce7', '#15803d'], ['#fef3c7', '#b45309'],
    ['#fce7f3', '#be185d'], ['#ede9fe', '#6d28d9'], ['#ffedd5', '#c2410c'],
  ];
  return colors[name.charCodeAt(0) % colors.length];
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 animate-pulse">
      <div className="p-4 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-slate-200 rounded w-2/5" />
          <div className="h-2.5 bg-slate-100 rounded w-1/3" />
        </div>
        <div className="h-6 w-16 bg-slate-100 rounded-full" />
      </div>
      <div className="mx-4 mb-4 h-10 bg-slate-50 rounded-xl" />
      <div className="h-48 bg-slate-100" />
    </div>
  );
}

function StudentTripCard({ student }: { student: StudentCard }) {
  const busLoc = student.active_trip?.last_known_location;
  const stopLoc = student.stop_location;
  const isActive = !!student.active_trip;
  const isApproaching = student.active_trip?.approaching_alert_sent;
  const centerLat = busLoc?.latitude ?? stopLoc?.latitude ?? -1.3965;
  const centerLng = busLoc?.longitude ?? stopLoc?.longitude ?? 36.7582;
  const speed = busLoc?.speed_kph ?? 0;
  const [bgColor, textColor] = avatarColor(student.name);

  return (
    <div className={`bg-white rounded-2xl overflow-hidden shadow-sm border transition-all duration-300 ${
      isApproaching
        ? 'border-amber-300 shadow-amber-100 shadow-md'
        : isActive
        ? 'border-blue-100 shadow-blue-50 shadow-md'
        : 'border-slate-100'
    }`}>

      {/* Approaching banner */}
      {isApproaching && (
        <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-4 py-2.5 flex items-center gap-2.5">
          <Bell size={15} className="text-white animate-bounce flex-shrink-0" />
          <p className="text-xs font-bold text-white tracking-wide">
            Bus approaching {student.stop_name} — get ready!
          </p>
        </div>
      )}

      {/* Active trip gradient header */}
      {isActive && !isApproaching && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 flex items-center gap-2">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-xs font-bold text-white tracking-wide">LIVE TRACKING</span>
          <span className="ml-auto text-[11px] text-blue-200 font-mono">{student.active_trip!.vehicle_plate}</span>
        </div>
      )}

      {/* Student info */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-lg font-bold"
          style={{ background: bgColor, color: textColor }}
        >
          {student.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-slate-900 text-sm leading-tight">{student.name}</h2>
          <p className="text-[11px] text-slate-400 mt-0.5 truncate">{student.school_name}</p>
        </div>
        {isActive ? (
          <div className="flex-shrink-0 flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            On the way
          </div>
        ) : (
          <div className="flex-shrink-0 flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-400 text-[11px] font-medium px-2.5 py-1 rounded-full">
            <Clock size={10} />
            No trip
          </div>
        )}
      </div>

      {/* Trip info strip */}
      <div className="mx-4 mb-3">
        {isActive ? (
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
            <div className="flex items-center gap-2 flex-wrap">
              {student.active_trip!.started_at && (
                <div className="flex items-center gap-1.5 text-[11px] text-blue-700">
                  <CheckCircle2 size={12} className="text-emerald-500" />
                  <span>Started {formatTime(student.active_trip!.started_at)}</span>
                  <span className="text-blue-300">·</span>
                  <span className="font-semibold">{formatElapsed(student.active_trip!.started_at)}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[11px] text-blue-700 ml-auto">
                <MapPin size={11} className="text-blue-500" />
                <span className="font-semibold truncate max-w-[120px]">{student.stop_name}</span>
                <span className="text-blue-300">#{student.stop_sequence}</span>
              </div>
            </div>
            {busLoc && (
              <div className="flex items-center gap-3 mt-2 pt-2 border-t border-blue-100">
                <div className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                  speed > 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'
                }`}>
                  <Navigation size={10} />
                  {speed > 0 ? `${speed.toFixed(0)} km/h` : 'Stationary'}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-blue-400 ml-auto">
                  <Wifi size={10} />
                  <span>Updated {formatTime(busLoc.recorded_at)}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center flex-shrink-0">
              <MapPin size={14} className="text-slate-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600">Pickup stop</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{student.stop_name} · Stop #{student.stop_sequence}</p>
            </div>
            <ChevronRight size={14} className="text-slate-300 ml-auto" />
          </div>
        )}
      </div>

      {/* Map */}
      <div className="h-52 w-full relative z-0">
        <MapContainer
          center={[centerLat, centerLng]}
          zoom={15}
          scrollWheelZoom={false}
          zoomControl={false}
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {stopLoc && (
            <>
              <Marker position={[stopLoc.latitude, stopLoc.longitude]} icon={stopIcon}>
                <Popup><strong>Pickup Stop</strong><br />{student.stop_name}</Popup>
              </Marker>
              <Circle
                center={[stopLoc.latitude, stopLoc.longitude]}
                radius={200}
                pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.08, weight: 1.5, dashArray: '5' }}
              />
            </>
          )}
          {busLoc && (
            <>
              <Marker position={[busLoc.latitude, busLoc.longitude]} icon={busIcon}>
                <Popup>
                  <strong>{student.active_trip?.vehicle_plate}</strong><br />
                  {speed > 0 ? `${speed.toFixed(1)} km/h` : 'Stationary'}
                </Popup>
              </Marker>
              <MapRecenter lat={busLoc.latitude} lng={busLoc.longitude} />
            </>
          )}
        </MapContainer>

        {/* Map overlay */}
        {isActive && busLoc && (
          <div className="absolute bottom-2 left-2 z-[400] bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-md">
            <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
              <Bus size={10} className="text-white" />
            </div>
            <span className="text-[11px] font-bold text-slate-700">{student.active_trip!.vehicle_plate}</span>
            {speed > 0 && (
              <span className="text-[10px] text-slate-400 border-l border-slate-200 pl-2">{speed.toFixed(0)} km/h</span>
            )}
          </div>
        )}

        {!isActive && (
          <div className="absolute inset-0 z-[400] bg-slate-900/10 flex items-center justify-center pointer-events-none">
            <div className="bg-white/90 backdrop-blur-sm rounded-xl px-4 py-2 shadow-sm border border-slate-200">
              <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                <Clock size={11} />
                No active trip
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ParentDashboard({ students, lastUpdated, loading }: Props) {
  const activeCount = students.filter(s => s.active_trip).length;

  // Loading skeleton
  if (loading && students.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-white rounded-2xl animate-pulse border border-slate-100" />
        <SkeletonCard />
      </div>
    );
  }

  // Empty state
  if (!loading && students.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center mb-5 shadow-inner">
          <Bus size={36} className="text-blue-400" />
        </div>
        <h3 className="text-base font-bold text-slate-700">No children linked</h3>
        <p className="text-sm text-slate-400 mt-2 max-w-xs leading-relaxed">
          Contact your school administrator to link your children to this account.
        </p>
        <div className="mt-6 flex items-center gap-2 text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5">
          <Shield size={13} className="text-slate-300" />
          Your account is secure and verified
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero status card */}
      <div className={`rounded-2xl p-4 text-white shadow-lg ${
        activeCount > 0
          ? 'bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700'
          : 'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-800'
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-white/60 uppercase tracking-widest mb-1">
              {activeCount > 0 ? 'Live Status' : 'Status'}
            </p>
            <h2 className="text-xl font-bold leading-tight">
              {activeCount > 0
                ? `${activeCount} bus${activeCount > 1 ? 'es' : ''} on the road`
                : 'All clear'}
            </h2>
            <p className="text-sm text-white/70 mt-1">
              {activeCount > 0
                ? `Tracking ${students.length} student${students.length > 1 ? 's' : ''}`
                : 'No active trips right now'}
            </p>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            activeCount > 0 ? 'bg-white/20' : 'bg-white/10'
          }`}>
            {activeCount > 0
              ? <Bus size={24} className="text-white" />
              : <Shield size={24} className="text-white/70" />
            }
          </div>
        </div>

        {/* Children pills */}
        <div className="flex flex-wrap gap-2 mt-4">
          {students.map(s => (
            <div key={s.id} className={`flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              s.active_trip ? 'bg-white/25 text-white' : 'bg-white/10 text-white/50'
            }`}>
              {s.active_trip && <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-pulse" />}
              {s.name.split(' ')[0]}
            </div>
          ))}
        </div>

        {lastUpdated && (
          <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/10">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            <span className="text-[11px] text-white/50">
              Updated {lastUpdated.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {/* Student cards */}
      {students.map(student => (
        <StudentTripCard key={student.id} student={student} />
      ))}

      <p className="text-center text-[11px] text-slate-300 pb-2">
        Location updates every 5 seconds
      </p>
    </div>
  );
}
