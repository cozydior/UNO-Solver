import { describe, expect, it } from 'vitest';
import {
  CLASSIC_ROOMS,
  SavedSession,
  applyMatchFee,
  archiveSession,
  recommendRoom,
  sessionNet,
  sessionWinPct,
  stopLines,
  winStats,
} from './money';

describe('session math', () => {
  it('tracks net from session start', () => {
    expect(sessionNet({ startCoins: 10_000, startedAt: 1, multi: 20, gold: 1500, fee: 300 }, 12_500)).toBe(2_500);
    expect(sessionNet(null, 12_500)).toBe(0);
  });

  it('archives a session with gold, games, and wins', () => {
    const first = archiveSession(
      { startCoins: 1000, startedAt: 100, multi: 8, gold: 800, fee: 120 },
      1200,
      [{ delta: 200, balance: 1200, at: 150, multi: 8 }],
      200,
    );
    const second = archiveSession(
      { startCoins: 1200, startedAt: 300, multi: 8, gold: 800, fee: 120 },
      1100,
      [{ delta: -100, balance: 1100, at: 350, multi: 8 }],
      400,
    );
    expect(first.net).toBe(200);
    expect(first.gold).toBe(800);
    expect(first.wins).toBe(1);
    expect(second.net).toBe(-100);
    expect(second.wins).toBe(0);
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

describe('classic rooms', () => {
  it('lists the classic gold · multi · fee tables', () => {
    expect(CLASSIC_ROOMS.map((room) => [room.gold, room.multi, room.fee])).toEqual([
      [100, 1, 30],
      [400, 4, 60],
      [800, 8, 120],
      [1500, 20, 300],
      [3000, 40, 600],
      [6000, 80, 1200],
      [24000, 200, 3000],
    ]);
  });

  it('always subtracts the upfront match fee from the match result', () => {
    expect(applyMatchFee(400, 120)).toBe(280);
    expect(applyMatchFee(-200, 120)).toBe(-320);
    expect(applyMatchFee(0, 30)).toBe(-30);
    expect(applyMatchFee(30, 30)).toBe(0);
  });

  it('recommends a climb-safe classic table from bankroll', () => {
    expect(recommendRoom(20_000, []).multi).toBe(20);
    expect(recommendRoom(5_000, []).multi).toBe(4);
    expect(recommendRoom(3_000, []).multi).toBe(1);
    expect(recommendRoom(1_200_000, []).multi).toBe(200);
  });

  it('stays on the smallest classic table when the bankroll is thin', () => {
    const advice = recommendRoom(400, []);
    expect(advice.multi).toBe(1);
    expect(advice.thin).toBe(true);
  });

  it('blocks seats below the cheapest classic table', () => {
    const advice = recommendRoom(50, []);
    expect(advice.room).toBeNull();
    expect(advice.multi).toBeNull();
  });
});

describe('win stats', () => {
  it('tracks total game win rate only', () => {
    const closed: SavedSession[] = [
      {
        id: 'a',
        startCoins: 1000,
        endCoins: 1100,
        startedAt: 1,
        endedAt: 2,
        multi: 8,
        gold: 800,
        games: 1,
        wins: 1,
        net: 100,
      },
      {
        id: 'b',
        startCoins: 1100,
        endCoins: 1000,
        startedAt: 3,
        endedAt: 4,
        multi: 8,
        gold: 800,
        games: 1,
        wins: 0,
        net: -100,
      },
    ];
    const stats = winStats(
      [
        { delta: 100, balance: 1100, at: 1 },
        { delta: -50, balance: 1050, at: 2 },
        { delta: 200, balance: 1250, at: 3 },
      ],
      closed,
    );
    expect(stats.gameWinPct).toBe(67);
    expect(stats.games).toBe(3);
    expect(stats.gameWins).toBe(2);
  });
});
