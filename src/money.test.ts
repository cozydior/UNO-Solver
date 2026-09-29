import { describe, expect, it } from 'vitest';
import {
  GO_WILD_ROOMS,
  SavedSession,
  applyMatchFee,
  archiveSession,
  formatEv,
  pointsFromMatch,
  recommendRoom,
  sessionNet,
  sessionWinPct,
  stopLines,
  winStats,
} from './money';

describe('session math', () => {
  it('tracks net from session start', () => {
    expect(sessionNet({ startCoins: 10_000, startedAt: 1, multi: 20, gold: 2000, fee: 300 }, 12_500)).toBe(2_500);
    expect(sessionNet(null, 12_500)).toBe(0);
  });

  it('archives a session with gold, games, wins, and EV', () => {
    const first = archiveSession(
      { startCoins: 1000, startedAt: 100, multi: 8, gold: 1000, fee: 120 },
      2176,
      [{ delta: 1176, balance: 2176, at: 150, multi: 8, match: 1296, ev: 162 }],
      200,
    );
    const second = archiveSession(
      { startCoins: 2176, startedAt: 300, multi: 8, gold: 1000, fee: 120 },
      1096,
      [{ delta: -1080, balance: 1096, at: 350, multi: 8, match: -960, ev: -120 }],
      400,
    );
    expect(first.net).toBe(1176);
    expect(first.gold).toBe(1000);
    expect(first.wins).toBe(1);
    expect(first.ev).toBe(162);
    expect(second.net).toBe(-1080);
    expect(second.wins).toBe(0);
    expect(second.ev).toBe(-120);
    expect(sessionWinPct(first)).toBe(100);
    expect(sessionWinPct(second)).toBe(0);
  });

  it('auto-stop lines include the upfront match fee in exposure', () => {
    const lines = stopLines(20_000, 20);
    expect(lines.exposure).toBe(50 * 20 + 300);
    expect(lines.stopLoss).toBeGreaterThan(0);
    expect(lines.stopWin).toBeGreaterThan(lines.stopLoss);
  });
});

describe('go wild rooms', () => {
  it('lists Go Wild multi · fee · min tables', () => {
    expect(GO_WILD_ROOMS.map((room) => [room.multi, room.fee, room.gold])).toEqual([
      [2, 30, 200],
      [4, 60, 500],
      [8, 120, 1000],
      [20, 300, 2000],
      [40, 600, 4000],
      [80, 1200, 8000],
      [200, 3000, 30000],
      [600, 9000, 90000],
    ]);
  });

  it('always subtracts the upfront match fee from the match result', () => {
    expect(applyMatchFee(400, 120)).toBe(280);
    expect(applyMatchFee(-200, 120)).toBe(-320);
    expect(applyMatchFee(0, 30)).toBe(-30);
    expect(applyMatchFee(30, 30)).toBe(0);
  });

  it('reverse-engineers card-point EV from match coins ÷ multi', () => {
    expect(pointsFromMatch(1296, 8)).toBe(162);
    expect(pointsFromMatch(664, 8)).toBe(83);
    expect(pointsFromMatch(-960, 8)).toBe(-120);
    expect(pointsFromMatch(-1000, 8)).toBe(-125);
    expect(formatEv(162)).toBe('+162 EV');
  expect(formatEv(-120)).toBe('-120 EV');
  });

  it('recommends a climb-safe Go Wild table from bankroll', () => {
    expect(recommendRoom(20_000, []).multi).toBe(8);
    expect(recommendRoom(5_000, []).multi).toBe(2);
    expect(recommendRoom(3_000, []).multi).toBe(2);
    expect(recommendRoom(1_200_000, []).multi).toBe(600);
  });

  it('stays on the smallest Go Wild table when the bankroll is thin', () => {
    const advice = recommendRoom(400, []);
    expect(advice.multi).toBe(2);
    expect(advice.thin).toBe(true);
  });

  it('blocks seats below the cheapest Go Wild table', () => {
    const advice = recommendRoom(50, []);
    expect(advice.room).toBeNull();
    expect(advice.multi).toBeNull();
  });
});

describe('win stats', () => {
  it('tracks win rate and total EV', () => {
    const closed: SavedSession[] = [
      {
        id: 'a',
        startCoins: 1000,
        endCoins: 2176,
        startedAt: 1,
        endedAt: 2,
        multi: 8,
        gold: 1000,
        games: 1,
        wins: 1,
        net: 1176,
        ev: 162,
      },
      {
        id: 'b',
        startCoins: 2176,
        endCoins: 1096,
        startedAt: 3,
        endedAt: 4,
        multi: 8,
        gold: 1000,
        games: 1,
        wins: 0,
        net: -1080,
        ev: -120,
      },
    ];
    const stats = winStats(
      [
        { delta: 1176, balance: 2176, at: 1, multi: 8, match: 1296, ev: 162 },
        { delta: -1080, balance: 1096, at: 2, multi: 8, match: -960, ev: -120 },
        { delta: 280, balance: 1376, at: 3, multi: 8, match: 400, ev: 50 },
      ],
      closed,
    );
    expect(stats.gameWinPct).toBe(67);
    expect(stats.games).toBe(3);
    expect(stats.gameWins).toBe(2);
    expect(stats.ev).toBe(92);
  });
});
