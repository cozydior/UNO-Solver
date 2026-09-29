import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CoinResult, SavedSession, Session } from './money';
import {
  loadCoins,
  loadHistory,
  loadSession,
  loadSessions,
  saveCoins,
  saveHistory,
  saveSession,
  saveSessions,
} from './storage';

const UPDATED_AT_KEY = 'gowild-updated-at';
/** One shared cloud save for every browser / device. */
const SHARED_SYNC_ID = 'main';

export type TrackerSnapshot = {
  coins: number;
  history: CoinResult[];
  session: Session | null;
  sessions: SavedSession[];
  updatedAt: number;
};

function env(name: string): string {
  return (import.meta.env[name] as string | undefined)?.trim() ?? '';
}

export function isSyncConfigured(): boolean {
  return Boolean(env('VITE_SUPABASE_URL') && env('VITE_SUPABASE_ANON_KEY'));
}

export function getSyncId(): string {
  const fromEnv = env('VITE_SYNC_ID');
  return fromEnv || SHARED_SYNC_ID;
}

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient | null {
  if (!isSyncConfigured()) return null;
  if (!client) {
    client = createClient(env('VITE_SUPABASE_URL'), env('VITE_SUPABASE_ANON_KEY'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

function isEmpty(snapshot: TrackerSnapshot): boolean {
  return (
    snapshot.coins === 0 &&
    snapshot.history.length === 0 &&
    snapshot.sessions.length === 0 &&
    snapshot.session === null
  );
}

function richness(snapshot: TrackerSnapshot): number {
  return (
    snapshot.history.length * 10 +
    snapshot.sessions.length * 5 +
    (snapshot.session ? 2 : 0) +
    (snapshot.coins > 0 ? 1 : 0)
  );
}

/** Pick the fuller save so Chrome local data wins over an empty cloud row. */
function pickSharedSave(local: TrackerSnapshot, remote: TrackerSnapshot | null): TrackerSnapshot {
  if (!remote || isEmpty(remote)) return local;
  if (isEmpty(local)) return remote;
  const localRich = richness(local);
  const remoteRich = richness(remote);
  if (localRich > remoteRich) return local;
  if (remoteRich > localRich) return remote;
  return remote.updatedAt >= local.updatedAt ? remote : local;
}

export function readLocalSnapshot(): TrackerSnapshot {
  const stamped = Number(localStorage.getItem(UPDATED_AT_KEY) || 0);
  return {
    coins: loadCoins(),
    history: loadHistory(),
    session: loadSession(),
    sessions: loadSessions(),
    updatedAt: Number.isFinite(stamped) && stamped > 0 ? stamped : Date.now(),
  };
}

export function writeLocalSnapshot(snapshot: TrackerSnapshot): void {
  saveCoins(snapshot.coins);
  saveHistory(snapshot.history);
  saveSession(snapshot.session);
  saveSessions(snapshot.sessions);
  localStorage.setItem(UPDATED_AT_KEY, String(snapshot.updatedAt));
}

export async function pullRemoteSnapshot(): Promise<TrackerSnapshot | null> {
  const sb = getClient();
  if (!sb) return null;
  const { data, error } = await sb
    .from('tracker_state')
    .select('coins, history, session, sessions, updated_at')
    .eq('id', getSyncId())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    coins: Number(data.coins) || 0,
    history: Array.isArray(data.history) ? (data.history as CoinResult[]) : [],
    session: (data.session as Session | null) ?? null,
    sessions: Array.isArray(data.sessions) ? (data.sessions as SavedSession[]) : [],
    updatedAt: data.updated_at ? Date.parse(data.updated_at) : 0,
  };
}

export async function pushRemoteSnapshot(snapshot: TrackerSnapshot): Promise<void> {
  const sb = getClient();
  if (!sb) return;
  const { error } = await sb.from('tracker_state').upsert(
    {
      id: getSyncId(),
      coins: snapshot.coins,
      history: snapshot.history,
      session: snapshot.session,
      sessions: snapshot.sessions,
      updated_at: new Date(snapshot.updatedAt).toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

/**
 * One shared cloud save: merge local Chrome data with remote `main`,
 * keep the fuller copy, then write it to both localStorage and Supabase.
 */
export async function hydrateFromCloud(): Promise<TrackerSnapshot> {
  const local = readLocalSnapshot();
  if (!isSyncConfigured()) return local;
  try {
    // Drop any old per-browser sync id so every device uses the shared row.
    localStorage.removeItem('gowild-sync-id');
    const remote = await pullRemoteSnapshot();
    const winner = pickSharedSave(local, remote);
    const stamped = {
      ...winner,
      updatedAt: Math.max(winner.updatedAt, Date.now()),
    };
    writeLocalSnapshot(stamped);
    await pushRemoteSnapshot(stamped);
    return stamped;
  } catch (error) {
    console.warn('Supabase sync pull failed', error);
    return local;
  }
}

let pushTimer: ReturnType<typeof setTimeout> | null = null;

export function scheduleCloudPush(snapshot: TrackerSnapshot): void {
  if (!isSyncConfigured()) return;
  const stamped = { ...snapshot, updatedAt: Date.now() };
  localStorage.setItem(UPDATED_AT_KEY, String(stamped.updatedAt));
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushRemoteSnapshot(stamped).catch((error) => {
      console.warn('Supabase sync push failed', error);
    });
  }, 450);
}
