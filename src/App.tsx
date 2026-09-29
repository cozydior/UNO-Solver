import { useEffect, useState } from 'react';
import {
  AutoCloseNotice,
  ClassicRoom,
  CoinResult,
  MULTIS,
  SavedSession,
  Session,
  archiveSession,
  applyMatchFee,
  stopLines,
} from './money';
import {
  clearAllStorage,
  loadCoins,
  loadHistory,
  loadSession,
  loadSessions,
  saveCoins,
  saveHistory,
  saveSession,
  saveSessions,
} from './storage';
import { hydrateFromCloud, isSyncConfigured, scheduleCloudPush } from './sync';
import { GameScreen } from './ui/GameScreen';
import { HomeScreen } from './ui/HomeScreen';

type Screen = 'home' | 'game';

export default function App() {
  const [ready, setReady] = useState(!isSyncConfigured());
  const [screen, setScreen] = useState<Screen>('home');
  const [coins, setCoins] = useState(() => loadCoins());
  const [history, setHistory] = useState<CoinResult[]>(() => loadHistory());
  const [closedSessions, setClosedSessions] = useState<SavedSession[]>(() => loadSessions());
  const [session, setSession] = useState<Session | null>(() => {
    const saved = loadSession();
    if (!saved) return null;
    if (!(MULTIS as number[]).includes(saved.multi)) return null;
    return saved;
  });
  const [lastDelta, setLastDelta] = useState<number | null>(null);
  const [autoClose, setAutoClose] = useState<AutoCloseNotice | null>(null);
  const [syncLabel, setSyncLabel] = useState(isSyncConfigured() ? 'Syncing…' : '');

  useEffect(() => {
    let cancelled = false;
    if (!isSyncConfigured()) return;
    hydrateFromCloud()
      .then((snapshot) => {
        if (cancelled) return;
        setCoins(snapshot.coins);
        setHistory(snapshot.history);
        setClosedSessions(snapshot.sessions);
        const nextSession =
          snapshot.session && (MULTIS as number[]).includes(snapshot.session.multi)
            ? snapshot.session
            : null;
        setSession(nextSession);
        setSyncLabel('Synced');
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setSyncLabel('Local only');
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveCoins(coins);
  }, [coins, ready]);
  useEffect(() => {
    if (!ready) return;
    saveHistory(history);
  }, [history, ready]);
  useEffect(() => {
    if (!ready) return;
    saveSession(session);
  }, [session, ready]);
  useEffect(() => {
    if (!ready) return;
    saveSessions(closedSessions);
  }, [closedSessions, ready]);

  useEffect(() => {
    if (!ready || !isSyncConfigured()) return;
    scheduleCloudPush({
      coins,
      history,
      session,
      sessions: closedSessions,
      updatedAt: Date.now(),
    });
    setSyncLabel('Synced');
  }, [coins, history, session, closedSessions, ready]);

  function archiveActive(active: Session, nextCoins: number, nextHistory: CoinResult[], endedAt = Date.now()) {
    const games = nextHistory.filter((item) => item.at >= active.startedAt).length;
    if (games === 0 && nextCoins === active.startCoins) return null;
    const closed = archiveSession(active, nextCoins, nextHistory, endedAt);
    setClosedSessions((current) => [...current.filter((item) => item.id !== closed.id), closed]);
    return closed;
  }

  function limitHit(active: Session, nextCoins: number): AutoCloseNotice | null {
    const lines = stopLines(active.startCoins, active.multi);
    const net = nextCoins - active.startCoins;
    if (net >= lines.stopWin) return { reason: 'take-profit', net, multi: active.multi };
    if (net <= -lines.stopLoss) return { reason: 'stop-loss', net, multi: active.multi };
    return null;
  }

  function finish(matchResult: number) {
    if (!session) {
      setScreen('home');
      return;
    }
    const active = session;
    const fee = active.fee;
    const delta = applyMatchFee(matchResult, fee);
    const nextCoins = coins + delta;
    const at = Date.now();
    const nextHistory = [
      ...history,
      { delta, balance: nextCoins, at, multi: active.multi, fee, match: Math.round(matchResult) },
    ];
    setHistory(nextHistory);
    setCoins(nextCoins);
    setLastDelta(delta);
    setScreen('home');

    const hit = limitHit(active, nextCoins);
    if (hit) {
      archiveActive(active, nextCoins, nextHistory, at);
      setSession(null);
      setAutoClose(hit);
      return;
    }
    setAutoClose(null);
  }

  if (!ready) {
    return (
      <main className="shell">
        <p className="quiet">Loading cloud save…</p>
      </main>
    );
  }

  return (
    <main className="shell">
      {syncLabel ? <p className="sync-pill">{syncLabel}</p> : null}
      {screen === 'home' ? (
        <HomeScreen
          coins={coins}
          history={history}
          session={session}
          closedSessions={closedSessions}
          lastDelta={lastDelta}
          autoClose={autoClose}
          onDraftCoins={(next) => {
            setCoins(next);
            setLastDelta(null);
            setAutoClose(null);
          }}
          onStartSession={(startCoins, room) => {
            setCoins(startCoins);
            setSession({
              startCoins,
              startedAt: Date.now(),
              multi: room.multi,
              gold: room.gold,
              fee: room.fee,
            });
            setLastDelta(null);
            setAutoClose(null);
          }}
          onEndSession={() => {
            if (session) archiveActive(session, coins, history);
            setSession(null);
            setLastDelta(null);
            setAutoClose(null);
          }}
          onPickRoom={(room: ClassicRoom) => {
            if (!session) return;
            setSession({ ...session, multi: room.multi, gold: room.gold, fee: room.fee });
            setAutoClose(null);
          }}
          onReset={() => {
            clearAllStorage();
            setCoins(0);
            setHistory([]);
            setClosedSessions([]);
            setSession(null);
            setLastDelta(null);
            setAutoClose(null);
            setScreen('home');
          }}
          onStartGame={() => {
            if (!session) return;
            setLastDelta(null);
            setAutoClose(null);
            setScreen('game');
          }}
        />
      ) : (
        <GameScreen
          coins={coins}
          fee={session?.fee ?? 0}
          roomLabel={
            session
              ? `${session.gold.toLocaleString('en-US')} · ${session.multi}×`
              : ''
          }
          onBack={() => setScreen('home')}
          onFinish={finish}
        />
      )}
    </main>
  );
}
