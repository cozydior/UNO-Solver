import { CLASSIC_ROOMS, CoinResult, SavedSession, Session } from './money';

const COINS = 'gowild-coins';
const HISTORY = 'gowild-history';
const SESSION = 'gowild-session';
const SESSIONS = 'gowild-sessions';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function loadCoins(): number {
  const coins = read<number>(COINS, 0);
  return Number.isFinite(coins) ? coins : 0;
}

export function saveCoins(coins: number): void {
  localStorage.setItem(COINS, JSON.stringify(coins));
}

export function loadHistory(): CoinResult[] {
  const history = read<CoinResult[]>(HISTORY, []);
  if (!Array.isArray(history)) return [];
  return history
    .map((item) => ({
      delta: Number(item.delta) || 0,
      balance: Number(item.balance) || 0,
      at: Number(item.at) || Date.now(),
      multi: typeof item.multi === 'number' ? item.multi : undefined,
      fee: typeof item.fee === 'number' ? item.fee : undefined,
      match: typeof item.match === 'number' ? item.match : undefined,
      ev: typeof item.ev === 'number' ? item.ev : undefined,
      note: typeof item.note === 'string' ? item.note : undefined,
    }))
    .filter((item) => Number.isFinite(item.delta) && Number.isFinite(item.balance));
}

export function saveHistory(history: CoinResult[]): void {
  localStorage.setItem(HISTORY, JSON.stringify(history));
}

export function loadSession(): Session | null {
  const session = read<Session | null>(SESSION, null);
  if (!session || !Number.isFinite(session.startCoins) || !Number.isFinite(session.startedAt)) return null;
  if (!Number.isFinite(session.multi) || !Number.isFinite(session.gold)) return null;
  const fee =
    Number.isFinite(session.fee) && session.fee > 0
      ? session.fee
      : CLASSIC_ROOMS.find((room) => room.multi === session.multi)?.fee ?? 0;
  return { ...session, fee };
}

export function saveSession(session: Session | null): void {
  if (session === null) localStorage.removeItem(SESSION);
  else localStorage.setItem(SESSION, JSON.stringify(session));
}

export function loadSessions(): SavedSession[] {
  const sessions = read<SavedSession[]>(SESSIONS, []);
  if (!Array.isArray(sessions)) return [];
  return sessions
    .map((item) => ({
      id: String(item.id ?? `${item.startedAt}-${item.endedAt}`),
      startCoins: Number(item.startCoins) || 0,
      endCoins: Number(item.endCoins) || 0,
      startedAt: Number(item.startedAt) || 0,
      endedAt: Number(item.endedAt) || 0,
      multi: Number(item.multi) || 1,
      gold: Number(item.gold) || 0,
      games: Number(item.games) || 0,
      wins: Number(item.wins) || 0,
      net: Number(item.net) || 0,
      ev: Number.isFinite(Number(item.ev)) ? Number(item.ev) : 0,
    }))
    .filter((item) => item.startedAt > 0 && item.endedAt > 0)
    .sort((a, b) => a.endedAt - b.endedAt);
}

export function saveSessions(sessions: SavedSession[]): void {
  localStorage.setItem(SESSIONS, JSON.stringify(sessions));
}

export function clearAllStorage(): void {
  localStorage.removeItem(COINS);
  localStorage.removeItem(HISTORY);
  localStorage.removeItem(SESSION);
  localStorage.removeItem(SESSIONS);
  localStorage.removeItem('gowild-events');
  localStorage.removeItem('gowild-room');
}
