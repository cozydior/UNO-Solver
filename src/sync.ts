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

const SYNC_ID_KEY = 'gowild-sync-id';
const UPDATED_AT_KEY = 'gowild-updated-at';

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
  const existing = localStorage.getItem(SYNC_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(SYNC_ID_KEY, id);
  return id;
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

/** Prefer remote when it exists and is newer or local is empty. */
export async function hydrateFromCloud(): Promise<TrackerSnapshot> {
  const local = readLocalSnapshot();
  if (!isSyncConfigured()) return local;
  try {
    const remote = await pullRemoteSnapshot();
    if (!remote) {
      await pushRemoteSnapshot(local);
      return local;
    }
    const localEmpty =
      local.coins === 0 && local.history.length === 0 && local.sessions.length === 0 && !local.session;
    if (localEmpty || remote.updatedAt >= local.updatedAt - 2000) {
      writeLocalSnapshot(remote);
      return remote;
    }
    await pushRemoteSnapshot(local);
    return local;
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
