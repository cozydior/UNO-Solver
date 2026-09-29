import { useEffect, useMemo, useState } from 'react';
import {
  AutoCloseNotice,
  CLASSIC_ROOMS,
  ClassicRoom,
  CoinResult,
  SavedSession,
  Session,
  formatCoins,
  formatMulti,
  formatRoom,
  recommendRoom,
  sessionNet,
  sessionWinPct,
  stopLines,
} from '../money';
import { CoinChart } from './widgets';

export function HomeScreen({
  coins,
  history,
  session,
  closedSessions,
  lastDelta,
  autoClose,
  onDraftCoins,
  onStartSession,
  onEndSession,
  onPickRoom,
  onReset,
  onStartGame,
}: {
  coins: number;
  history: CoinResult[];
  session: Session | null;
  closedSessions: SavedSession[];
  lastDelta: number | null;
  autoClose: AutoCloseNotice | null;
  onDraftCoins: (coins: number) => void;
  onStartSession: (startCoins: number, room: ClassicRoom) => void;
  onEndSession: () => void;
  onPickRoom: (room: ClassicRoom) => void;
  onReset: () => void;
  onStartGame: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);
  const [draftCoins, setDraftCoins] = useState(coins > 0 ? String(coins) : '');
  const draftValue = Number(draftCoins.replace(/[^\d]/g, '')) || 0;
  const inSession = session !== null;

  useEffect(() => {
    if (!inSession) setDraftCoins(coins > 0 ? String(coins) : '');
  }, [inSession]);

  const advice = useMemo(
    () => recommendRoom(inSession ? coins : draftValue, history),
    [inSession, coins, draftValue, history],
  );
  const lines = session ? stopLines(session.startCoins, session.multi) : advice;
  const net = sessionNet(session, coins);
  const games = session ? history.filter((item) => item.at >= session.startedAt) : [];
  const sessionWins = games.filter((item) => item.delta > 0).length;
  const past = [...closedSessions].reverse().slice(0, 6);

  return (
    <div className="home">
      <header className="hero hero-compact">
        <div>
          <p className="brand">Go Wild</p>
          <h1>Color track</h1>
        </div>
        <p className="lede">Track voids. Lock a classic table. Auto-stop on your limits.</p>
      </header>

      {autoClose ? (
        <p className={`banner ${autoClose.reason === 'take-profit' ? 'good' : ''}`}>
          Session auto-closed on {autoClose.reason === 'take-profit' ? 'take-profit' : 'stop-loss'} at{' '}
          {formatMulti(autoClose.multi)} ({autoClose.net >= 0 ? '+' : ''}
          {formatCoins(autoClose.net)}). Start a new session when ready.
        </p>
      ) : null}

      <div className="home-board">
        <section className="panel home-session">
          {!inSession ? (
            <>
              <p className="kicker">Start session</p>
              <h2 className="mode-title">Session maker</h2>
              <p className="quiet">Enter starting gold, pick a classic table, then start.</p>
              <input
                className="coins"
                inputMode="numeric"
                aria-label="Starting coins"
                placeholder="0"
                value={draftCoins}
                onChange={(event) => {
                  const raw = event.target.value.replace(/[^\d]/g, '');
                  setDraftCoins(raw);
                  onDraftCoins(Number(raw) || 0);
                }}
              />
              <p className="kicker mode-label">Classic tables</p>
              <p className="quiet">{advice.reason}</p>
              <DraftRoomPicker
                coins={draftValue}
                adviceMulti={advice.room?.multi ?? null}
                onStart={(room) => {
                  if (draftValue <= 0) return;
                  onStartSession(draftValue, room);
                }}
              />
            </>
          ) : (
            <>
              <div className="rowline">
                <div>
                  <p className="kicker">Live session</p>
                  <h2 className="mode-title">{formatCoins(coins)}</h2>
                  <p className="session-line">
                    Started {formatCoins(session.startCoins)} ·{' '}
                    <span className={net >= 0 ? 'good-text' : 'warn'}>
                      {net >= 0 ? '+' : ''}
                      {formatCoins(net)}
                    </span>
                    {' · '}
                    {formatRoom({ gold: session.gold, multi: session.multi, fee: session.fee })}
                  </p>
                  <p className="quiet">
                    {games.length} game{games.length === 1 ? '' : 's'}
                    {games.length > 0 ? ` · ${Math.round((sessionWins / games.length) * 100)}% win` : ''}
                  </p>
                </div>
                <button type="button" onClick={onEndSession}>
                  End session
                </button>
              </div>

              {lastDelta !== null ? (
                <p className={`banner ${lastDelta >= 0 ? 'good' : ''}`}>
                  Last round {lastDelta >= 0 ? '+' : ''}
                  {formatCoins(lastDelta)}
                </p>
              ) : null}

              <p className="kicker mode-label">Classic table</p>
              <div className="rooms mode-rooms" role="group" aria-label="Classic rooms">
                {CLASSIC_ROOMS.map((room) => {
                  const affordable = coins >= room.gold;
                  const recommended = advice.room?.multi === room.multi;
                  return (
                    <button
                      key={room.multi}
                      type="button"
                      className={recommended ? 'is-rec-room' : ''}
                      aria-pressed={session.multi === room.multi}
                      disabled={!affordable}
                      onClick={() => onPickRoom(room)}
                    >
                      {formatRoom(room)}
                      {recommended ? ' · best' : ''}
                    </button>
                  );
                })}
              </div>

              <div className="stop-grid">
                <div>
                  <p className="kicker">Stop loss</p>
                  <p className="stop-value warn">−{formatCoins(lines.stopLoss)}</p>
                  <p className="quiet">Auto-closes from session start</p>
                </div>
                <div>
                  <p className="kicker">Take profit</p>
                  <p className="stop-value good-text">+{formatCoins(lines.stopWin)}</p>
                  <p className="quiet">
                    Entry −{formatCoins(session.fee)} each game · typical loss ~{formatCoins(lines.exposure)}
                  </p>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="panel home-history">
          <p className="kicker">Session history</p>
          <h2 className="mode-title history-title">Graph</h2>
          <CoinChart closed={closedSessions} history={history} />
          {past.length > 0 ? (
            <ul className="session-list">
              {past.map((item, index) => (
                <li key={item.id} className="session-row">
                  <span>
                    Session {closedSessions.length - index}
                    {` · ${formatRoom({ gold: item.gold, multi: item.multi })}`}
                    {item.games > 0 ? ` · ${item.wins}/${item.games}` : ''}
                  </span>
                  <span className={item.net >= 0 ? 'good-text' : 'warn'}>
                    {item.net >= 0 ? '+' : ''}
                    {formatCoins(item.net)}
                  </span>
                  <span className="session-tip">
                    {formatCoins(item.startCoins)} → {formatCoins(item.endCoins)}
                    {sessionWinPct(item) !== null ? ` · ${sessionWinPct(item)}% win` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>

      <div className="home-actions">
        <button type="button" className="primary wide start-game" disabled={!inSession} onClick={onStartGame}>
          {inSession ? 'Start color track' : 'Start a session first'}
        </button>
        <div className="danger-row">
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                return;
              }
              onReset();
              setConfirmReset(false);
            }}
          >
            {confirmReset ? 'Confirm reset everything' : 'Reset everything'}
          </button>
          {confirmReset ? (
            <button type="button" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DraftRoomPicker({
  coins,
  adviceMulti,
  onStart,
}: {
  coins: number;
  adviceMulti: number | null;
  onStart: (room: ClassicRoom) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const selected =
    picked !== null && CLASSIC_ROOMS.some((room) => room.multi === picked && coins >= room.gold)
      ? CLASSIC_ROOMS.find((room) => room.multi === picked)!
      : CLASSIC_ROOMS.find((room) => room.multi === adviceMulti) ?? null;

  return (
    <>
      <div className="rooms mode-rooms" role="group" aria-label="Pick classic room">
        {CLASSIC_ROOMS.map((room) => {
          const affordable = coins >= room.gold;
          const recommended = adviceMulti === room.multi;
          return (
            <button
              key={room.multi}
              type="button"
              className={recommended ? 'is-rec-room' : ''}
              aria-pressed={selected?.multi === room.multi}
              disabled={!affordable}
              onClick={() => setPicked(room.multi)}
            >
              {formatRoom(room)}
              {recommended ? ' · best' : ''}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="primary wide"
        disabled={selected === null || coins <= 0}
        onClick={() => selected && onStart(selected)}
      >
        {selected ? `Start session · ${formatRoom(selected)}` : 'Pick a classic table'}
      </button>
    </>
  );
}
