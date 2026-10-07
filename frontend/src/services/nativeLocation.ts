import { Capacitor, registerPlugin } from '@capacitor/core';
import { bufferLocation } from '../utils/offlineQueue';

const BackgroundGeolocation = registerPlugin<any>('BackgroundGeolocation');

let watcherId: string | null = null;
let webWatchId: number | null = null;

export async function startBackgroundTracking(
  tripId: number,
  onLocationUpdate?: (lat: number, lng: number) => void
) {
  if (Capacitor.isNativePlatform()) {
    try {
      watcherId = await BackgroundGeolocation.addWatcher(
        {
          backgroundMessage: 'SchoolTrack is broadcasting bus location to parents.',
          backgroundTitle: 'School Bus Tracking Active',
          requestPermissions: true,
          stale: false,
          distanceFilter: 10,
        },
        async (location: any, error: any) => {
          if (error || !location) return;
          await bufferLocation(tripId, {
            latitude: location.latitude,
            longitude: location.longitude,
            speed: location.speed,
            accuracy: location.accuracy,
          });
          onLocationUpdate?.(location.latitude, location.longitude);
        }
      );
    } catch (err) {
      console.error('Failed to start native background tracker', err);
    }
  } else {
    // Web fallback — request screen wake lock so screen-off doesn't kill GPS
    if ('wakeLock' in navigator) {
      try {
        await (navigator as any).wakeLock.request('screen');
      } catch {
        // Wake lock denied or unsupported — GPS still works while screen is on
      }
    }
    if ('geolocation' in navigator) {
      webWatchId = navigator.geolocation.watchPosition(
        async (pos) => {
          await bufferLocation(tripId, {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            speed: pos.coords.speed,
            accuracy: pos.coords.accuracy,
          });
          onLocationUpdate?.(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => console.warn('Web GPS error:', err.message),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
    }
  }
}

export async function stopBackgroundTracking() {
  if (Capacitor.isNativePlatform() && watcherId) {
    await BackgroundGeolocation.removeWatcher({ id: watcherId });
    watcherId = null;
  } else if (webWatchId !== null) {
    navigator.geolocation.clearWatch(webWatchId);
    webWatchId = null;
  }
}
