import { useMemo, useState } from 'react';
import {
  CoinResult,
  MULTIS,
  SavedSession,
  filterHistoryByMulti,
  filterSessionsByMulti,
  formatEv,
  formatMulti,
  formatRoom,
  sessionWinPct,
  winStats,
} from '../money';

const EV_UP = '#6ee7a8';
const EV_DOWN = '#f07878';
export const SESSION_WINDOW = 20;

type HoverPoint = {
  session: SavedSession;
  x: number;
  y: number;
  cumulative: number;
};

function windowStats(sessions: SavedSession[]) {
  const games = sessions.reduce((sum, item) => sum + item.games, 0);
  const wins = sessions.reduce((sum, item) => sum + item.wins, 0);
  const ev = Math.round(sessions.reduce((sum, item) => sum + (item.ev ?? 0), 0) * 10) / 10;
  return {
    sessions: sessions.length,
    games,
    wins,
    ev,
    winPct: games === 0 ? null : Math.round((wins / games) * 100),
  };
}

export function CoinChart({
  closed,
  history,
}: {
  closed: SavedSession[];
  history: CoinResult[];
}) {
  const [filter, setFilter] = useState<number | 'all'>('all');
  const [hover, setHover] = useState<HoverPoint | null>(null);

  const filteredClosed = useMemo(() => filterSessionsByMulti(closed, filter), [closed, filter]);
  const orderedAll = useMemo(
    () => [...filteredClosed].sort((a, b) => a.endedAt - b.endedAt),
    [filteredClosed],
  );
  const ordered = useMemo(() => orderedAll.slice(-SESSION_WINDOW), [orderedAll]);
  const window = windowStats(ordered);

  // Game-level stats for the same window (for sub labels when useful)
  const windowHistory = useMemo(() => {
    if (ordered.length === 0) return [] as CoinResult[];
    const start = ordered[0].startedAt;
    const end = ordered[ordered.length - 1].endedAt;
    return filterHistoryByMulti(history, filter).filter((item) => item.at >= start && item.at <= end);
  }, [ordered, history, filter]);
  const gameStats = winStats(windowHistory);

  const filterControls = (
    <label className="chart-filter">
      <span className="kicker">Show</span>
      <select
        aria-label="Filter sessions by multiplier"
        value={filter === 'all' ? 'all' : String(filter)}
        onChange={(event) => {
          const value = event.target.value;
          setFilter(value === 'all' ? 'all' : Number(value));
        }}
      >
        <option value="all">All multipliers</option>
        {MULTIS.map((multi) => (
          <option key={multi} value={multi}>
            {formatMulti(multi)} only
          </option>
        ))}
      </select>
    </label>
  );

  if (ordered.length === 0) {
    return (
      <div className="chart empty">
        <div className="chart-meta">
          <div>
            <p className="kicker">Last {SESSION_WINDOW}</p>
            <p className="quiet">Graph fills after a session ends.</p>
          </div>
          {filterControls}
        </div>
        {gameStats.games > 0 ? (
          <div className="chart-stats-row">
            <Stat label="Win rate" value={gameStats.gameWinPct !== null ? `${gameStats.gameWinPct}%` : '—'} sub="" />
            <Stat label="Window EV" value={formatEv(gameStats.ev)} sub="" tone={gameStats.ev >= 0 ? 'good' : 'warn'} />
          </div>
        ) : (
          <p className="quiet">Shows the last {SESSION_WINDOW} closed sessions.</p>
        )}
      </div>
    );
  }

  const points: Array<{ at: number; ev: number; session: SavedSession | null; label: string }> = [
    { at: ordered[0].startedAt, ev: 0, session: null, label: 'Start' },
  ];
  let running = 0;
  ordered.forEach((item, index) => {
    running += item.ev ?? 0;
    points.push({
      at: item.endedAt,
      ev: Math.round(running * 10) / 10,
      session: item,
      label: `Session ${index + 1}`,
    });
  });

  const width = 720;
  const height = 180;
  const padX = 22;
  const padY = 28;
  const values = points.map((point) => point.ev);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const span = Math.max(1, max - min);
  const coords = points.map((point, index) => {
    const x = padX + (index / Math.max(1, points.length - 1)) * (width - padX * 2);
    const y = height - padY - ((point.ev - min) / span) * (height - padY * 2);
    return { x, y, ...point };
  });
  const zeroY = height - padY - ((0 - min) / span) * (height - padY * 2);
  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1].x.toFixed(1)} ${height - padY} L${coords[0].x.toFixed(1)} ${height - padY} Z`;
  const last = coords[coords.length - 1];
  const up = last.ev >= 0;
  const stroke = up ? EV_UP : EV_DOWN;

  return (
    <div className="chart">
      <div className="chart-meta">
        <div className="chart-stat-block">
          <p className="kicker">
            Last {window.sessions}
            {filter !== 'all' ? ` · ${formatMulti(filter)}` : ''}
            {orderedAll.length > SESSION_WINDOW ? ` of ${orderedAll.length}` : ''}
          </p>
          <p className={window.ev >= 0 ? 'good-text' : 'warn'}>{formatEv(window.ev)}</p>
        </div>
        <div className="chart-stat-block">
          <p className="kicker">Win rate</p>
          <p>{window.winPct !== null ? `${window.winPct}%` : '—'}</p>
        </div>
        {filterControls}
      </div>

      <div className="chart-stage">
        <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="EV by session">
          <defs>
            <linearGradient id="evFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity="0.4" />
              <stop offset="100%" stopColor={stroke} stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={padX} y1={zeroY} x2={width - padX} y2={zeroY} className="chart-zero" />
          <path d={area} fill="url(#evFill)" />
          <path
            d={line}
            fill="none"
            stroke={stroke}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={up ? 'chart-line' : 'chart-line is-down'}
          />
          {coords.map((point, index) => (
            <circle
              key={`${point.at}-${index}`}
              cx={point.x}
              cy={point.y}
              r={index === coords.length - 1 ? 7 : 5}
              fill={stroke}
              className="chart-dot"
              onMouseEnter={() => {
                if (!point.session) {
                  setHover(null);
                  return;
                }
                setHover({
                  session: point.session,
                  x: point.x,
                  y: point.y,
                  cumulative: point.ev,
                });
              }}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>

        {hover ? (
          <div
            className="chart-pop"
            style={{
              left: `${(hover.x / width) * 100}%`,
              top: `${(hover.y / height) * 100}%`,
            }}
          >
            <p className="kicker">{formatRoom({ gold: hover.session.gold, multi: hover.session.multi })}</p>
            <p className={(hover.session.ev ?? 0) >= 0 ? 'good-text' : 'warn'}>
              {formatEv(hover.session.ev ?? 0)}
            </p>
            <p className="quiet">
              {hover.session.wins}/{hover.session.games} games
              {sessionWinPct(hover.session) !== null ? ` · ${sessionWinPct(hover.session)}% win` : ''}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'warn';
}) {
  return (
    <div className="chart-stat">
      <p className="kicker">{label}</p>
      <p className={tone === 'good' ? 'good-text' : tone === 'warn' ? 'warn' : undefined}>{value}</p>
      {sub ? <p className="quiet">{sub}</p> : null}
    </div>
  );
}
