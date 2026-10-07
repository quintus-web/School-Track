import { useState, useEffect, useRef, useCallback } from 'react';
import { bufferLocation, getPendingLocations, markLocationsSynced, getQueueCount } from '../src/utils/offlineQueue';

export function useTripTracker(tripId: number | null, token: string | null) {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [bufferedCount, setBufferedCount] = useState<number>(0);
  const [lastCoords, setLastCoords] = useState<{ lat: number; lng: number; time: string } | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('Idle');

  const watchIdRef = useRef<number | null>(null);
  const syncIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const flushQueue = useCallback(async () => {
    if (!tripId || !token || !navigator.onLine) return;
    const pending = await getPendingLocations(tripId);
    if (pending.length === 0) return;

    setSyncStatus(`Syncing ${pending.length} buffered points...`);
    try {
      const res = await fetch(`http://localhost:8000/api/tracking/driver/trips/${tripId}/bulk-locations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(pending),
      });
      if (res.ok) {
        const data = await res.json();
        const acked: string[] = data.synced_uuids || [];
        await markLocationsSynced(acked);
        const remaining = await getQueueCount(tripId);
        setBufferedCount(remaining);
        setSyncStatus(remaining === 0 ? 'Live (synced)' : `${remaining} buffered`);
      } else {
        setSyncStatus('Server rejected sync batch');
      }
    } catch {
      setSyncStatus('Sync stalled (offline)');
    }
  }, [tripId, token]);

  useEffect(() => {
    if (tripId && token) {
      syncIntervalRef.current = window.setInterval(flushQueue, 6000);
    }
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    };
  }, [tripId, token, flushQueue]);

  const startTracking = useCallback(() => {
    if (!tripId || !('geolocation' in navigator)) return;
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        await bufferLocation(tripId, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speed: pos.coords.speed,
          accuracy: pos.coords.accuracy,
        });
        setLastCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          time: new Date().toLocaleTimeString(),
        });
        const count = await getQueueCount(tripId);
        setBufferedCount(count);
        if (navigator.onLine) flushQueue();
      },
      (err) => setSyncStatus(`GPS hardware error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  }, [tripId, flushQueue]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  return { isOnline, bufferedCount, lastCoords, syncStatus, startTracking, stopTracking, flushQueue };
}
