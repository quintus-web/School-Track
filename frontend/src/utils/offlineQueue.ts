import { openDB } from 'idb';

const DB_NAME = 'schooltrack';
const STORE = 'pending_locations';

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'client_uuid' });
        store.createIndex('trip_id', 'trip_id');
        store.createIndex('synced', 'synced');
      }
    },
  });
}

export async function bufferLocation(
  tripId: number,
  coords: { latitude: number; longitude: number; speed: number | null; accuracy: number | null }
) {
  const db = await getDb();
  await db.put(STORE, {
    client_uuid: crypto.randomUUID(),
    trip_id: tripId,
    latitude: coords.latitude,
    longitude: coords.longitude,
    speed_kph: coords.speed != null ? coords.speed * 3.6 : 0,
    accuracy_meters: coords.accuracy ?? 0,
    recorded_at: new Date().toISOString(),
    synced: 0,
  });
}

export async function getPendingLocations(tripId: number) {
  const db = await getDb();
  const all = await db.getAllFromIndex(STORE, 'trip_id', tripId);
  return all.filter((r) => r.synced === 0);
}

export async function markLocationsSynced(uuids: string[]) {
  const db = await getDb();
  const tx = db.transaction(STORE, 'readwrite');
  await Promise.all(uuids.map((id) => tx.store.delete(id)));
  await tx.done;
}

export async function getQueueCount(tripId: number): Promise<number> {
  const pending = await getPendingLocations(tripId);
  return pending.length;
}
