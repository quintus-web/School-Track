import { useState, useEffect } from 'react';
import { Upload, Users, Bus, Route, RefreshCw, School } from 'lucide-react';
import StudentRosterImportModal from './StudentRosterImportModal';

interface Props {
  token: string;
  schoolSlug: string;
  schoolName: string;
  onRosterUpdated?: () => void;
}

interface Stats {
  students: number;
  guardians: number;
  routes: number;
  vehicles: number;
}

export default function AdminSchoolDashboard({ token, schoolSlug, schoolName, onRosterUpdated }: Props) {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const fetchStats = async () => {
    setIsLoadingStats(true);
    try {
      const res = await fetch(
        `http://localhost:8000/api/students/admin/${schoolSlug}/stats/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) setStats(await res.json());
    } catch {
      // Stats are non-critical, fail silently
    } finally {
      setIsLoadingStats(false);
    }
  };

  useEffect(() => { fetchStats(); }, [schoolSlug]);

  const statCards = [
    { label: 'Students', value: stats?.students, icon: Users, color: 'blue' },
    { label: 'Guardians', value: stats?.guardians, icon: Users, color: 'violet' },
    { label: 'Routes', value: stats?.routes, icon: Route, color: 'emerald' },
    { label: 'Vehicles', value: stats?.vehicles, icon: Bus, color: 'amber' },
  ] as const;

  const colorMap = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   border: 'border-blue-100' },
    violet: { bg: 'bg-violet-50', icon: 'text-violet-600', border: 'border-violet-100' },
    emerald:{ bg: 'bg-emerald-50',icon: 'text-emerald-600',border: 'border-emerald-100' },
    amber:  { bg: 'bg-amber-50',  icon: 'text-amber-600',  border: 'border-amber-100' },
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
            <School size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Fleet & Roster Management</h1>
            <p className="text-xs text-slate-500">{schoolName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchStats}
            disabled={isLoadingStats}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-white border border-transparent hover:border-slate-200 transition"
            title="Refresh stats"
          >
            <RefreshCw size={15} className={isLoadingStats ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setIsImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm transition"
          >
            <Upload size={14} />
            Bulk Upload Students
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {statCards.map(({ label, value, icon: Icon, color }) => {
          const c = colorMap[color];
          return (
            <div key={label} className={`bg-white rounded-2xl border ${c.border} p-4 shadow-sm`}>
              <div className={`w-8 h-8 rounded-lg ${c.bg} flex items-center justify-center mb-3`}>
                <Icon size={16} className={c.icon} />
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {isLoadingStats ? (
                  <span className="inline-block w-8 h-6 bg-slate-100 rounded animate-pulse" />
                ) : (
                  value ?? '—'
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            onClick={() => setIsImportOpen(true)}
            className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition group text-left"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center flex-shrink-0 transition">
              <Upload size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-800">Import Student Roster</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Upload CSV to bulk-create students & guardians</p>
            </div>
          </button>

          <div className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-slate-200 opacity-50 cursor-not-allowed text-left">
            <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
              <Bus size={16} className="text-slate-400" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-600">Manage Fleet</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Coming soon</p>
            </div>
          </div>
        </div>
      </div>

      <StudentRosterImportModal
        schoolSlug={schoolSlug}
        authToken={token}
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={() => {
          setIsImportOpen(false);
          fetchStats();
          onRosterUpdated?.();
        }}
      />
    </div>
  );
}
