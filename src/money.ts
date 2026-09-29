export type Color = 'red' | 'yellow' | 'green' | 'blue';

export const COLORS: Color[] = ['red', 'yellow', 'green', 'blue'];
export const SEAT_NAMES = ['You', 'Left', 'Across', 'Right'] as const;
export type Seat = 0 | 1 | 2 | 3;

/** Classic Go Wild rooms: table gold · multiplier · upfront match fee */
export const CLASSIC_ROOMS = [
  { gold: 100, multi: 1, fee: 30 },
  { gold: 400, multi: 4, fee: 60 },
  { gold: 800, multi: 8, fee: 120 },
  { gold: 1500, multi: 20, fee: 300 },
  { gold: 3000, multi: 40, fee: 600 },
  { gold: 6000, multi: 80, fee: 1200 },
  { gold: 24000, multi: 200, fee: 3000 },
] as const;

export type ClassicRoom = (typeof CLASSIC_ROOMS)[number];
export const MULTIS = CLASSIC_ROOMS.map((room) => room.multi);

export interface CoinResult {
  delta: number;
  balance: number;
  at: number;
  multi?: number;
  fee?: number;
  match?: number;
  note?: string;
}

export interface Session {
  startCoins: number;
  startedAt: number;
  multi: number;
  gold: number;
  fee: number;
}

export interface SavedSession {
  id: string;
  startCoins: number;
  endCoins: number;
  startedAt: number;
  endedAt: number;
  multi: number;
  gold: number;
  games: number;
  wins: number;
  net: number;
}

export type AutoCloseNotice = {
  reason: 'stop-loss' | 'take-profit';
  net: number;
  multi: number;
};

export interface ModeAdvice {
  room: ClassicRoom | null;
  multi: number | null;
  reason: string;
  thin: boolean;
  steppedDown: boolean;
  stopLoss: number;
  stopWin: number;
  exposure: number;
}

const RESERVE_BUYINS = 12;
const TYPICAL_LOSS_POINTS = 50;
const MIN_RESULTS = 5;

export function formatCoins(amount: number): string {
  return Math.round(amount).toLocaleString('en-US');
}

export function formatMulti(multi: number): string {
  return `${multi}×`;
}

export function formatRoom(room: { gold: number; multi: number; fee?: number }): string {
  const base = `${formatCoins(room.gold)} · ${formatMulti(room.multi)}`;
  if (room.fee == null) return base;
  return `${base} · −${formatCoins(room.fee)} fee`;
}

export function colorName(color: Color): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

export function roomByMulti(multi: number | null | undefined): ClassicRoom | null {
  if (multi == null) return null;
  return CLASSIC_ROOMS.find((room) => room.multi === multi) ?? null;
}

/** Match result from points, minus the upfront entry fee charged every game. */
export function applyMatchFee(matchResult: number, fee: number): number {
  return Math.round(matchResult) - fee;
}

export function sessionNet(session: Session | null, coins: number): number {
  if (!session) return 0;
  return coins - session.startCoins;
}

export function sessionWinPct(session: Pick<SavedSession, 'games' | 'wins'>): number | null {
  if (session.games <= 0) return null;
  return Math.round((session.wins / session.games) * 100);
}

export function archiveSession(
  session: Session,
  coins: number,
  history: CoinResult[],
  endedAt = Date.now(),
): SavedSession {
  const gamesIn = history.filter((item) => item.at >= session.startedAt && item.at <= endedAt);
  const wins = gamesIn.filter((item) => item.delta > 0).length;
  return {
    id: `${session.startedAt}-${endedAt}`,
    startCoins: session.startCoins,
    endCoins: coins,
    startedAt: session.startedAt,
    endedAt,
    multi: session.multi,
    gold: session.gold,
    games: gamesIn.length,
    wins,
    net: coins - session.startCoins,
  };
}

export function stopLines(startCoins: number, multi: number): { stopLoss: number; stopWin: number; exposure: number } {
  const fee = roomByMulti(multi)?.fee ?? 0;
  const exposure = TYPICAL_LOSS_POINTS * multi + fee;
  const stopLoss = Math.max(exposure * 3, Math.round(startCoins * 0.25));
  const stopWin = Math.max(exposure * 5, Math.round(startCoins * 0.4));
  return { stopLoss, stopWin, exposure };
}

export function recommendRoom(coins: number, history: CoinResult[] = []): ModeAdvice {
  if (coins < CLASSIC_ROOMS[0].gold) {
    const room = CLASSIC_ROOMS[0];
    return {
      room: null,
      multi: null,
      thin: true,
      steppedDown: false,
      reason: `Need at least ${formatCoins(room.gold)} coins to sit classic ${formatRoom(room)}.`,
      ...stopLines(room.gold, room.multi),
    };
  }

  const safe = CLASSIC_ROOMS.filter((room) => coins >= room.gold * RESERVE_BUYINS);
  const affordable = CLASSIC_ROOMS.filter((room) => coins >= room.gold);
  const thin = safe.length === 0;
  let room: ClassicRoom = thin ? affordable[0] : safe[safe.length - 1];
  let steppedDown = false;
  let steppedFrom: number | null = null;

  const pool = history.filter((item) => item.multi === room.multi).slice(-20);
  const recentNet = pool.reduce((sum, item) => sum + item.delta, 0);
  if (!thin && pool.length >= MIN_RESULTS && recentNet < 0) {
    const index = CLASSIC_ROOMS.findIndex((item) => item.multi === room.multi);
    const lower =
      [...CLASSIC_ROOMS.slice(0, index)].reverse().find((item) => safe.includes(item)) ??
      [...CLASSIC_ROOMS.slice(0, index)].reverse().find((item) => coins >= item.gold);
    if (lower && lower.multi !== room.multi) {
      steppedFrom = room.multi;
      room = lower;
      steppedDown = true;
    }
  }

  const lines = stopLines(coins, room.multi);
  return {
    room,
    multi: room.multi,
    thin,
    steppedDown,
    reason: roomReason(room, thin, steppedDown, steppedFrom, lines),
    ...lines,
  };
}

/** @deprecated use recommendRoom */
export function recommendMulti(coins: number, history: CoinResult[], _session: Session | null = null): ModeAdvice {
  return recommendRoom(coins, history);
}

export function winStats(history: CoinResult[], _closed: SavedSession[] = []): {
  games: number;
  gameWins: number;
  gameWinPct: number | null;
} {
  const games = history.length;
  const gameWins = history.filter((item) => item.delta > 0).length;
  return {
    games,
    gameWins,
    gameWinPct: games === 0 ? null : Math.round((gameWins / games) * 100),
  };
}

function roomReason(
  room: ClassicRoom,
  thin: boolean,
  steppedDown: boolean,
  steppedFrom: number | null,
  lines: { stopLoss: number; stopWin: number; exposure: number },
): string {
  if (steppedDown && steppedFrom !== null) {
    return `${formatMulti(steppedFrom)} has been losing recently, so sit ${formatRoom(room)}.`;
  }
  if (thin) {
    return `${formatRoom(room)} is the safest classic table you can sit on this bankroll.`;
  }
  return `${formatRoom(room)} leaves about ${RESERVE_BUYINS} buy-ins. Auto-stops at −${formatCoins(lines.stopLoss)} / +${formatCoins(lines.stopWin)}.`;
}
