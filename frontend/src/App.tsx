import React, { useState, useEffect } from 'react';
import { Bus, LogOut, AlertCircle, RefreshCw } from 'lucide-react';
import AdminSchoolDashboard from './components/AdminSchoolDashboard';
import ParentDashboard from './components/ParentDashboard';
import 'leaflet/dist/leaflet.css';

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

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('access_token'));
  const [isStaff, setIsStaff] = useState<boolean>(JSON.parse(localStorage.getItem('is_staff') || 'false'));
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [students, setStudents] = useState<StudentCard[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [parentLoading, setParentLoading] = useState(true);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('http://localhost:8000/api/auth/login/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.non_field_errors?.[0] || 'Invalid phone number or password.');
        return;
      }
      localStorage.setItem('access_token', data.access);
      localStorage.setItem('is_staff', JSON.stringify(data.user?.is_staff || false));
      setIsStaff(data.user?.is_staff || false);
      setToken(data.access);
    } catch {
      setLoginError('Unable to connect. Please check your connection.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('is_staff');
    setToken(null);
    setIsStaff(false);
    setStudents([]);
    setLastUpdated(null);
  };

  const loadParentDashboard = async (showRefresh = false) => {
    if (!token) return;
    if (showRefresh) setIsRefreshing(true);
    try {
      const res = await fetch('http://localhost:8000/api/students/parent/dashboard/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
        setLastUpdated(new Date());
      }
    } catch (err) {
      console.error('Error fetching parent data', err);
    } finally {
      setIsRefreshing(false);
      setParentLoading(false);
    }
  };

  useEffect(() => {
    if (!token || isStaff) return;
    loadParentDashboard();
    const interval = setInterval(loadParentDashboard, 5000);
    return () => clearInterval(interval);
  }, [token, isStaff]);

  // ── Login ─────────────────────────────────────────────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur mb-4">
              <Bus size={32} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">SchoolTrack Kenya</h1>
            <p className="text-blue-200 text-sm mt-1">Safe journeys, informed parents</p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-6">
            {loginError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
                <AlertCircle size={15} className="flex-shrink-0" />
                {loginError}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="07XX XXX XXX"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
              >
                {isLoggingIn ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <p className="text-center text-[11px] text-slate-400 mt-5">
              For parents, guardians & school administrators
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Admin ─────────────────────────────────────────────────────────────────
  if (isStaff) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-800">
        <header className="bg-white border-b border-slate-200 px-5 py-3.5 flex items-center justify-between sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Bus size={16} className="text-white" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm">SchoolTrack</span>
              <span className="ml-2 text-[10px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                Admin
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </header>
        <AdminSchoolDashboard
          token={token!}
          schoolSlug="demo-academy"
          schoolName="Demo Academy Nairobi"
        />
      </div>
    );
  }

  // ── Parent / Guardian ─────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 pb-12">
      <header className="bg-white border-b border-slate-200 px-4 py-3.5 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Bus size={16} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-sm">SchoolTrack</span>
            <span className="ml-2 text-[10px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              Live
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadParentDashboard(true)}
            disabled={isRefreshing}
            className="p-2 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-slate-100 transition"
            title="Refresh"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>
      <main className="max-w-2xl mx-auto p-4">
        <ParentDashboard students={students} lastUpdated={lastUpdated} loading={parentLoading} />
      </main>
    </div>
  );
}
