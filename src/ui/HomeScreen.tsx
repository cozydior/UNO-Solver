import { useEffect, useMemo, useState } from 'react';
import {
  AutoCloseNotice,
  ClassicRoom,
  CoinResult,
  GO_WILD_ROOMS,
  SavedSession,
  Session,
  formatCoins,
  formatEv,
  formatMulti,
  recommendRoom,
  resultEv,
  roomRiskForBankroll,
  sessionNet,
  sessionWinPct,
  winStats,
} from '../money';
import { CoinChart, SESSION_WINDOW } from './widgets';

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
  }, [inSession, coins]);

  const bankroll = inSession ? coins : draftValue;
  const advice = useMemo(() => recommendRoom(bankroll, history), [bankroll, history]);
  const net = sessionNet(session, coins);
  const games = session ? history.filter((item) => item.at >= session.startedAt) : [];
  const sessionEv = games.reduce((sum, item) => sum + resultEv(item), 0);
  const sessionWins = games.filter((item) => (item.match ?? item.delta) > 0).length;
  const lastEv = lastDelta !== null && history.length > 0 ? resultEv(history[history.length - 1]) : null;
  const past = [...closedSessions].reverse().slice(0, SESSION_WINDOW);
  const overall = winStats(history, closedSessions);

  return (
    <div className="home">
      {autoClose ? (
        <p className={`banner ${autoClose.reason === 'take-profit' ? 'good' : ''}`}>
          Session auto-closed on {autoClose.reason === 'take-profit' ? 'take-profit' : 'stop-loss'} at{' '}
          {formatMulti(autoClose.multi)} ({autoClose.net >= 0 ? '+' : ''}
          {formatCoins(autoClose.net)}). Start a new session when ready.
        </p>
      ) : null}

      <div className="home-board">
        <section className="panel home-session glow-panel">
          {!inSession ? (
            <>
              <div className="session-head">
                <p className="kicker">Bankroll</p>
                <h2 className="mode-title">Starting gold</h2>
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
              </div>
              <p className="kicker mode-label">Go Wild tables</p>
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
              <div className="session-head">
                <div className="rowline">
                  <div>
                    <p className="kicker">Live session</p>
                    <h2 className="mode-title">{formatCoins(coins)}</h2>
                    <p className="session-line">
                      Started {formatCoins(session.startCoins)} · bankroll{' '}
                      <span className={net >= 0 ? 'good-text' : 'warn'}>
                        {net >= 0 ? '+' : ''}
                        {formatCoins(net)}
                      </span>
                    </p>
                    <p className="session-line">
                      <span className={sessionEv >= 0 ? 'good-text' : 'warn'}>{formatEv(sessionEv)}</span>
                      {' · '}
                      {formatMulti(session.multi)}
                      {' · min '}
                      {formatCoins(session.gold)}
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
                  <p className={`banner compact-banner ${lastDelta >= 0 ? 'good' : ''}`}>
                    Last {lastDelta >= 0 ? '+' : ''}
                    {formatCoins(lastDelta)}
                    {lastEv !== null && lastEv !== undefined ? (
                      <>
                        {' · '}
                        <span className={lastEv >= 0 ? 'good-text' : 'warn'}>{formatEv(lastEv)}</span>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </div>

              <p className="kicker mode-label">Switch table</p>
              <div className="draft-picker live-picker">
                <RoomGrid
                  coins={coins}
                  adviceMulti={advice.room?.multi ?? null}
                  selected={session.multi}
                  onPick={onPickRoom}
                />
              </div>
            </>
          )}
        </section>

        <section className="panel home-history glow-panel">
          <div className="history-head">
            <div>
              <p className="kicker">Performance</p>
              <h2 className="mode-title history-title">EV &amp; win rate</h2>
            </div>
            {overall.games > 0 || closedSessions.length > 0 ? (
              <div className="all-time-card" aria-label="All-time stats">
                <p className="kicker">
                  All time
                  <span className="all-time-games"> · {overall.games} game{overall.games === 1 ? '' : 's'}</span>
                </p>
                <div className="all-time-row">
                  <div className="all-time-col">
                    <p className="all-time-label">EV</p>
                    <p className={overall.ev >= 0 ? 'good-text all-time-value' : 'warn all-time-value'}>
                      {formatEv(overall.ev)}
                    </p>
                  </div>
                  <div className="all-time-divider" aria-hidden="true" />
                  <div className="all-time-col">
                    <p className="all-time-label">Win</p>
                    <p className="all-time-value">
                      {overall.gameWinPct !== null ? `${overall.gameWinPct}%` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
          <CoinChart closed={closedSessions} history={history} />
          {past.length > 0 ? (
            <ul className="session-list">
              {past.map((item, index) => (
                <li key={item.id} className="session-row">
                  <span>
                    Session {closedSessions.length - index}
                    {` · ${formatMulti(item.multi)}`}
                    {item.games > 0 ? ` · ${item.wins}/${item.games}` : ''}
                  </span>
                  <span className={(item.ev ?? 0) >= 0 ? 'good-text' : 'warn'}>{formatEv(item.ev ?? 0)}</span>
                  <span className="session-tip">
                    {sessionWinPct(item) !== null ? `${sessionWinPct(item)}% win` : '—'}
                    {' · bankroll '}
                    {item.net >= 0 ? '+' : ''}
                    {formatCoins(item.net)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="session-list empty-list">
              <p className="quiet">Closed sessions will list here (last {SESSION_WINDOW}).</p>
            </div>
          )}
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

function RoomGrid({
  coins,
  adviceMulti,
  selected,
  onPick,
}: {
  coins: number;
  adviceMulti: number | null;
  selected?: number | null;
  onPick: (room: ClassicRoom) => void;
}) {
  return (
    <div className="rooms mode-rooms wild-rooms" role="group" aria-label="Go Wild tables">
      {GO_WILD_ROOMS.map((room) => {
        const risk = roomRiskForBankroll(room, coins);
        const recommended = adviceMulti === room.multi;
        return (
          <button
            key={room.multi}
            type="button"
            className={[
              'room-card',
              recommended ? 'is-rec-room' : '',
              `risk-${risk.risk}`,
              !risk.affordable ? 'is-locked' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-pressed={selected === room.multi}
            disabled={!risk.affordable}
            onClick={() => onPick(room)}
          >
            <span className="room-top">
              <span className="room-multi">{formatMulti(room.multi)}</span>
              {recommended ? <span className="room-best">Best</span> : null}
              {!risk.affordable ? <span className="room-lock">Locked</span> : null}
            </span>
            <span className="room-meta">min {formatCoins(room.gold)}</span>
            <span className="room-foot">
              <span className="risk-meter" aria-hidden="true">
                {Array.from({ length: 5 }, (_, index) => (
                  <i key={index} className={index < risk.risk ? 'on' : ''} />
                ))}
              </span>
              <span className="room-risk">
                {risk.riskLabel}
                {risk.affordable ? ` · ${Math.floor(risk.buyIns)} BI` : ''}
              </span>
            </span>
          </button>
        );
      })}
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
    picked !== null && GO_WILD_ROOMS.some((room) => room.multi === picked && coins >= room.gold)
      ? GO_WILD_ROOMS.find((room) => room.multi === picked)!
      : GO_WILD_ROOMS.find((room) => room.multi === adviceMulti) ?? null;

  return (
    <div className="draft-picker">
      <RoomGrid
        coins={coins}
        adviceMulti={adviceMulti}
        selected={selected?.multi ?? null}
        onPick={(room) => setPicked(room.multi)}
      />
      <button
        type="button"
        className="primary wide session-start-btn"
        disabled={selected === null || coins <= 0}
        onClick={() => selected && onStart(selected)}
      >
        {selected ? `Start session · ${formatMulti(selected.multi)}` : 'Pick a Go Wild table'}
      </button>
    </div>
  );
}
