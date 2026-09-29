export type Color = 'red' | 'yellow' | 'green' | 'blue';

export const COLORS: Color[] = ['red', 'yellow', 'green', 'blue'];
export const SEAT_NAMES = ['You', 'Left', 'Across', 'Right'] as const;
export type Seat = 0 | 1 | 2 | 3;

/** Go Wild weekday rooms: multi · entry fee · min coins to sit */
export const GO_WILD_ROOMS = [
  { gold: 200, multi: 2, fee: 30, risk: 1 as const, riskLabel: 'Low' },
  { gold: 500, multi: 4, fee: 60, risk: 2 as const, riskLabel: 'Low' },
  { gold: 1000, multi: 8, fee: 120, risk: 2 as const, riskLabel: 'Medium' },
  { gold: 2000, multi: 20, fee: 300, risk: 3 as const, riskLabel: 'Medium' },
  { gold: 4000, multi: 40, fee: 600, risk: 3 as const, riskLabel: 'High' },
  { gold: 8000, multi: 80, fee: 1200, risk: 4 as const, riskLabel: 'High' },
  { gold: 30000, multi: 200, fee: 3000, risk: 5 as const, riskLabel: 'Extreme' },
  { gold: 90000, multi: 600, fee: 9000, risk: 5 as const, riskLabel: 'Extreme' },
] as const;

/** @deprecated use GO_WILD_ROOMS */
export const CLASSIC_ROOMS = GO_WILD_ROOMS;

export type WildRoom = (typeof GO_WILD_ROOMS)[number];
export type ClassicRoom = WildRoom;
export const MULTIS = GO_WILD_ROOMS.map((room) => room.multi);

export interface CoinResult {
  delta: number;
  balance: number;
  at: number;
  multi?: number;
  fee?: number;
  match?: number;
  /** Card-point EV reverse-engineered from match coins / multi */
  ev?: number;
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
  /** Sum of point EV across games in the session */
  ev: number;
}

export type AutoCloseNotice = {
  reason: 'stop-loss' | 'take-profit';
  net: number;
  multi: number;
};

export interface ModeAdvice {
  room: WildRoom | null;
  multi: number | null;
  reason: string;
  thin: boolean;
  steppedDown: boolean;
  stopLoss: number;
  stopWin: number;
  exposure: number;
  buyIns: number;
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
  const base = `${formatMulti(room.multi)} · min ${formatCoins(room.gold)}`;
  if (room.fee == null) return base;
  return `${base} · −${formatCoins(room.fee)} fee`;
}

export function formatEv(points: number): string {
  const rounded = Math.round(points * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toLocaleString('en-US')} EV`;
}

/** Edge % from point outcomes: net / absolute swing. */
export function formatEvPct(points: number, absSwing: number): string {
  if (absSwing <= 0) return '0% EV';
  const pct = Math.round((points / absSwing) * 100);
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct}% EV`;
}

export function colorName(color: Color): string {
  return color.charAt(0).toUpperCase() + color.slice(1);
}

export function roomByMulti(multi: number | null | undefined): WildRoom | null {
  if (multi == null) return null;
  return GO_WILD_ROOMS.find((room) => room.multi === multi) ?? null;
}

export function applyMatchFee(matchResult: number, fee: number): number {
  return Math.round(matchResult) - fee;
}

/** Reverse-engineer card-point EV from match coin payout and table multi. */
export function pointsFromMatch(matchResult: number, multi: number): number {
  if (!multi) return 0;
  return Math.round((matchResult / multi) * 10) / 10;
}

export function resultEv(item: Pick<CoinResult, 'ev' | 'match' | 'multi'>): number {
  if (typeof item.ev === 'number' && Number.isFinite(item.ev)) return item.ev;
  if (typeof item.match === 'number' && typeof item.multi === 'number' && item.multi > 0) {
    return pointsFromMatch(item.match, item.multi);
  }
  return 0;
}

export function sessionNet(session: Session | null, coins: number): number {
  if (!session) return 0;
  return coins - session.startCoins;
}

export function sessionWinPct(session: Pick<SavedSession, 'games' | 'wins'>): number | null {
  if (session.games <= 0) return null;
  return Math.round((session.wins / session.games) * 100);
}

export function sessionEv(session: Pick<SavedSession, 'ev'>): number {
  return Number.isFinite(session.ev) ? session.ev : 0;
}

export function archiveSession(
  session: Session,
  coins: number,
  history: CoinResult[],
  endedAt = Date.now(),
): SavedSession {
  const gamesIn = history.filter((item) => item.at >= session.startedAt && item.at <= endedAt);
  const wins = gamesIn.filter((item) => (item.match ?? item.delta) > 0).length;
  const ev = gamesIn.reduce((sum, item) => sum + resultEv(item), 0);
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
    ev: Math.round(ev * 10) / 10,
  };
}

export function stopLines(startCoins: number, multi: number): { stopLoss: number; stopWin: number; exposure: number } {
  const fee = roomByMulti(multi)?.fee ?? 0;
  const exposure = TYPICAL_LOSS_POINTS * multi + fee;
  const stopLoss = Math.max(exposure * 3, Math.round(startCoins * 0.25));
  const stopWin = Math.max(exposure * 5, Math.round(startCoins * 0.4));
  return { stopLoss, stopWin, exposure };
}

export function roomRiskForBankroll(room: WildRoom, coins: number): {
  buyIns: number;
  risk: number;
  riskLabel: string;
  affordable: boolean;
  recommended: boolean;
} {
  const affordable = coins >= room.gold;
  const buyIns = room.gold > 0 ? coins / room.gold : 0;
  let risk = room.risk;
  let riskLabel = room.riskLabel;
  if (affordable && buyIns < 6) {
    risk = Math.min(5, risk + 1) as 1 | 2 | 3 | 4 | 5;
    riskLabel = risk >= 5 ? 'Extreme' : risk >= 4 ? 'High' : riskLabel;
  } else if (affordable && buyIns >= RESERVE_BUYINS) {
    risk = Math.max(1, risk - 0) as 1 | 2 | 3 | 4 | 5;
  }
  return {
    buyIns,
    risk,
    riskLabel,
    affordable,
    recommended: false,
  };
}

export function recommendRoom(coins: number, history: CoinResult[] = []): ModeAdvice {
  if (coins < GO_WILD_ROOMS[0].gold) {
    const room = GO_WILD_ROOMS[0];
    return {
      room: null,
      multi: null,
      thin: true,
      steppedDown: false,
      buyIns: 0,
      reason: `Need at least ${formatCoins(room.gold)} coins to sit ${formatMulti(room.multi)}.`,
      ...stopLines(room.gold, room.multi),
    };
  }

  const safe = GO_WILD_ROOMS.filter((room) => coins >= room.gold * RESERVE_BUYINS);
  const affordable = GO_WILD_ROOMS.filter((room) => coins >= room.gold);
  const thin = safe.length === 0;
  let room: WildRoom = thin ? affordable[0] : safe[safe.length - 1];
  let steppedDown = false;
  let steppedFrom: number | null = null;

  const pool = history.filter((item) => item.multi === room.multi).slice(-20);
  const recentEv = pool.reduce((sum, item) => sum + resultEv(item), 0);
  if (!thin && pool.length >= MIN_RESULTS && recentEv < 0) {
    const index = GO_WILD_ROOMS.findIndex((item) => item.multi === room.multi);
    const lower =
      [...GO_WILD_ROOMS.slice(0, index)].reverse().find((item) => safe.includes(item)) ??
      [...GO_WILD_ROOMS.slice(0, index)].reverse().find((item) => coins >= item.gold);
    if (lower && lower.multi !== room.multi) {
      steppedFrom = room.multi;
      room = lower;
      steppedDown = true;
    }
  }

  const lines = stopLines(coins, room.multi);
  const buyIns = room.gold > 0 ? coins / room.gold : 0;
  return {
    room,
    multi: room.multi,
    thin,
    steppedDown,
    buyIns,
    reason: roomReason(room, thin, steppedDown, steppedFrom, lines, buyIns),
    ...lines,
  };
}

export function recommendMulti(coins: number, history: CoinResult[], _session: Session | null = null): ModeAdvice {
  return recommendRoom(coins, history);
}

export function winStats(
  history: CoinResult[],
  _closed: SavedSession[] = [],
): {
  games: number;
  gameWins: number;
  gameWinPct: number | null;
  ev: number;
  evAbs: number;
  evPct: number | null;
} {
  const games = history.length;
  const gameWins = history.filter((item) => (item.match ?? item.delta) > 0).length;
  const ev = history.reduce((sum, item) => sum + resultEv(item), 0);
  const evAbs = history.reduce((sum, item) => sum + Math.abs(resultEv(item)), 0);
  return {
    games,
    gameWins,
    gameWinPct: games === 0 ? null : Math.round((gameWins / games) * 100),
    ev: Math.round(ev * 10) / 10,
    evAbs: Math.round(evAbs * 10) / 10,
    evPct: evAbs <= 0 ? null : Math.round((ev / evAbs) * 100),
  };
}

export function filterHistoryByMulti(history: CoinResult[], multi: number | 'all'): CoinResult[] {
  if (multi === 'all') return history;
  return history.filter((item) => item.multi === multi);
}

export function filterSessionsByMulti(sessions: SavedSession[], multi: number | 'all'): SavedSession[] {
  if (multi === 'all') return sessions;
  return sessions.filter((item) => item.multi === multi);
}

function roomReason(
  room: WildRoom,
  thin: boolean,
  steppedDown: boolean,
  steppedFrom: number | null,
  lines: { stopLoss: number; stopWin: number; exposure: number },
  buyIns: number,
): string {
  if (steppedDown && steppedFrom !== null) {
    return `${formatMulti(steppedFrom)} has been −EV lately, so sit ${formatMulti(room.multi)} (${room.riskLabel} risk).`;
  }
  if (thin) {
    return `${formatMulti(room.multi)} is the safest table you can afford. Thin bankroll — play tight.`;
  }
  return `${formatMulti(room.multi)} leaves ~${Math.floor(buyIns)} buy-ins (${room.riskLabel} risk). Stops −${formatCoins(lines.stopLoss)} / +${formatCoins(lines.stopWin)}.`;
}
