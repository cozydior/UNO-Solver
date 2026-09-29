import { useState } from 'react';
import {
  CoinResult,
  SavedSession,
  formatCoins,
  formatRoom,
  sessionWinPct,
  winStats,
} from '../money';

export function CoinChart({
  closed,
  history,
}: {
  closed: SavedSession[];
  history: CoinResult[];
}) {
  const stats = winStats(history, closed);
  const ordered = [...closed].sort((a, b) => a.endedAt - b.endedAt);
  const [hover, setHover] = useState<SavedSession | null>(null);

  if (ordered.length === 0) {
    return (
      <div className="chart empty">
        <p className="quiet">Graph starts after a session ends. Each point is a finished session.</p>
        {stats.games > 0 ? (
          <p className="quiet">
            {stats.gameWins}/{stats.games} games
            {stats.gameWinPct !== null ? ` · ${stats.gameWinPct}% win` : ''}
          </p>
        ) : null}
      </div>
    );
  }

  const points: Array<{ at: number; balance: number; session: SavedSession | null; label: string }> = [
    {
      at: ordered[0].startedAt,
      balance: ordered[0].startCoins,
      session: null,
      label: 'Start',
    },
    ...ordered.map((item, index) => ({
      at: item.endedAt,
      balance: item.endCoins,
      session: item,
      label: `Session ${index + 1}`,
    })),
  ];

  const width = 720;
  const height = 280;
  const padX = 22;
  const padY = 28;
  const balances = points.map((point) => point.balance);
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const span = Math.max(1, max - min);
  const coords = points.map((point, index) => {
    const x = padX + (index / (points.length - 1)) * (width - padX * 2);
    const y = height - padY - ((point.balance - min) / span) * (height - padY * 2);
    return { x, y, ...point };
  });
  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const area = `${line} L${coords[coords.length - 1].x.toFixed(1)} ${height - padY} L${coords[0].x.toFixed(1)} ${height - padY} Z`;
  const last = coords[coords.length - 1];
  const first = coords[0];
  const delta = last.balance - first.balance;
  const up = delta >= 0;

  return (
    <div className="chart">
      <div className="chart-meta">
        <div>
          <p className="kicker">{closed.length} closed session{closed.length === 1 ? '' : 's'}</p>
          <p className={up ? 'good-text' : 'warn'}>
            {delta >= 0 ? '+' : ''}
            {formatCoins(delta)}
          </p>
        </div>
        <div className="chart-wins">
          <p className="kicker">Win rate</p>
          <p>{stats.gameWinPct !== null ? `${stats.gameWinPct}%` : '—'}</p>
          <p className="quiet">
            {stats.gameWins}/{stats.games} games
          </p>
        </div>
      </div>

      <div className="chart-stage">
        <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" aria-label="Coins by session">
          <defs>
            <linearGradient id="bankFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={up ? '#9adf7a' : '#e7c27a'} stopOpacity="0.35" />
              <stop offset="100%" stopColor={up ? '#9adf7a' : '#e7c27a'} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#bankFill)" />
          <path d={line} fill="none" stroke={up ? '#9adf7a' : '#e7c27a'} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          {coords.map((point, index) => (
            <circle
              key={`${point.at}-${index}`}
              cx={point.x}
              cy={point.y}
              r={index === coords.length - 1 ? 7 : 5}
              fill={up ? '#9adf7a' : '#e7c27a'}
              className="chart-dot"
              onMouseEnter={() => setHover(point.session)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>

        {hover ? (
          <div className="chart-tip">
            <p className="kicker">{formatRoom({ gold: hover.gold, multi: hover.multi })}</p>
            <p>
              {formatCoins(hover.startCoins)} → {formatCoins(hover.endCoins)} ·{' '}
              <span className={hover.net >= 0 ? 'good-text' : 'warn'}>
                {hover.net >= 0 ? '+' : ''}
                {formatCoins(hover.net)}
              </span>
            </p>
            <p className="quiet">
              {hover.wins}/{hover.games} games
              {sessionWinPct(hover) !== null ? ` · ${sessionWinPct(hover)}% win` : ''}
            </p>
          </div>
        ) : (
          <p className="chart-tip quiet">Hover a point for that session&apos;s gold and win rate.</p>
        )}
      </div>
    </div>
  );
}
