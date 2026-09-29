import { useState } from 'react';
import { COLORS, Color, SEAT_NAMES, applyMatchFee, colorName, formatCoins, formatEv, pointsFromMatch } from '../money';

type OppSeat = 1 | 2 | 3;
type Voids = Record<OppSeat, Color[]>;

const emptyVoids = (): Voids => ({ 1: [], 2: [], 3: [] });
const WILD_START = 8;
const PLUS4_START = 8;

export function GameScreen({
  coins,
  fee,
  multi,
  roomLabel,
  onBack,
  onFinish,
}: {
  coins: number;
  fee: number;
  multi: number;
  roomLabel: string;
  onBack: () => void;
  onFinish: (matchResult: number) => void;
}) {
  const [voids, setVoids] = useState<Voids>(emptyVoids);
  const [wildLeft, setWildLeft] = useState(WILD_START);
  const [plus4Left, setPlus4Left] = useState(PLUS4_START);
  const [ending, setEnding] = useState(false);
  const [delta, setDelta] = useState('');

  function resetTrack() {
    setVoids(emptyVoids());
    setWildLeft(WILD_START);
    setPlus4Left(PLUS4_START);
  }

  function toggle(seat: OppSeat, color: Color) {
    setVoids((current) => {
      const list = current[seat];
      return {
        ...current,
        [seat]: list.includes(color) ? list.filter((item) => item !== color) : [...list, color],
      };
    });
  }

  function clearSeat(seat: OppSeat) {
    setVoids((current) => ({ ...current, [seat]: [] }));
  }

  const parsed = Number(delta);
  const ready = delta.trim() !== '' && Number.isFinite(parsed);
  const matchResult = ready ? Math.round(parsed) : 0;
  const net = ready ? applyMatchFee(matchResult, fee) : 0;
  const ev = ready ? pointsFromMatch(matchResult, multi) : 0;

  return (
    <div className="game">
      <header className="topbar">
        <button type="button" onClick={onBack}>
          Home
        </button>
        <div className="topbar-mid">
          <p className="kicker">Live track{roomLabel ? ` · ${roomLabel}` : ''}</p>
          <p className="quiet">
            {formatCoins(coins)} coins
            {fee > 0 ? ` · entry −${formatCoins(fee)}` : ''}
          </p>
        </div>
        <button type="button" onClick={resetTrack}>
          Clear all
        </button>
      </header>

      <section className="board" aria-label="Table">
        <SeatPad
          seat={2}
          place="across"
          missing={voids[2]}
          onToggle={(color) => toggle(2, color)}
          onClear={() => clearSeat(2)}
        />
        <SeatPad
          seat={1}
          place="left"
          missing={voids[1]}
          onToggle={(color) => toggle(1, color)}
          onClear={() => clearSeat(1)}
        />
        <div className="board-specials" aria-label="Wild and +4 counters">
          <p className="kicker">Specials left</p>
          <div className="specials-row">
            <WildCounter
              kind="wild"
              left={wildLeft}
              total={WILD_START}
              onPlayed={() => setWildLeft((n) => Math.max(0, n - 1))}
              onUndo={() => setWildLeft((n) => Math.min(WILD_START, n + 1))}
            />
            <WildCounter
              kind="plus4"
              left={plus4Left}
              total={PLUS4_START}
              onPlayed={() => setPlus4Left((n) => Math.max(0, n - 1))}
              onUndo={() => setPlus4Left((n) => Math.min(PLUS4_START, n + 1))}
            />
          </div>
        </div>
        <SeatPad
          seat={3}
          place="right"
          missing={voids[3]}
          onToggle={(color) => toggle(3, color)}
          onClear={() => clearSeat(3)}
        />
      </section>

      <button type="button" className="primary wide end-game-btn" onClick={() => setEnding(true)}>
        End game
      </button>

      {ending ? (
        <div className="end-overlay" role="dialog" aria-modal="true" aria-label="End game">
          <section className="panel end-sheet">
            <p className="kicker">Match coins won or lost</p>
            <p className="quiet">
              Enter the match payout before the entry fee. We reverse {roomLabel || `${multi}×`} into card-point EV.
              Entry −{formatCoins(fee)} is always deducted from bankroll.
            </p>
            <input
              className="delta"
              inputMode="decimal"
              enterKeyHint="done"
              aria-label="Match coins won or lost"
              placeholder="1296 or -960"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              autoFocus
            />
            {ready ? (
              <div className="fee-preview">
                <p className={ev >= 0 ? 'good-text' : 'warn'}>{formatEv(ev)}</p>
                <p className="quiet">
                  Match {matchResult >= 0 ? '+' : ''}
                  {formatCoins(matchResult)} ÷ {multi}× · bankroll after fee{' '}
                  <span className={net >= 0 ? 'good-text' : 'warn'}>
                    {net >= 0 ? '+' : ''}
                    {formatCoins(net)}
                  </span>
                </p>
                <p className={net >= 0 ? 'good-text' : 'warn'}>
                  Balance becomes {formatCoins(coins + net)}
                </p>
              </div>
            ) : null}
            <div className="rooms">
              <button type="button" onClick={() => setEnding(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!ready}
                onClick={() => onFinish(matchResult)}
              >
                Save result
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function WildCounter({
  kind,
  left,
  total,
  onPlayed,
  onUndo,
}: {
  kind: 'wild' | 'plus4';
  left: number;
  total: number;
  onPlayed: () => void;
  onUndo: () => void;
}) {
  const label = kind === 'wild' ? 'Wild' : '+4';
  return (
    <div className={`special-card ${kind} ${left === 0 ? 'is-empty' : ''}`}>
      <button
        type="button"
        className="special-hit"
        disabled={left <= 0}
        onClick={onPlayed}
        aria-label={`${label} played, ${left} left`}
      >
        <SpecialFace kind={kind} />
        <div className="special-meta">
          <span className="special-count">{left}</span>
          <span className="special-label">{label}</span>
          <span className="special-hint">{left === 0 ? 'None left' : 'Tap when played'}</span>
          <div className="special-pips" aria-hidden="true">
            {Array.from({ length: total }, (_, index) => (
              <span key={index} className={`special-pip ${index < left ? 'is-left' : 'is-gone'}`} />
            ))}
          </div>
        </div>
      </button>
      <button type="button" className="special-undo" disabled={left >= total} onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}

function SpecialFace({ kind }: { kind: 'wild' | 'plus4' }) {
  if (kind === 'plus4') {
    return (
      <span className="special-face plus4" aria-hidden="true">
        <svg viewBox="0 0 64 96" className="special-svg">
          <rect x="2" y="2" width="60" height="92" rx="10" fill="#121212" stroke="#f3efe6" strokeWidth="2" />
          <circle cx="32" cy="38" r="16" fill="#1a1a1a" />
          <path d="M32 22 A16 16 0 0 1 48 38 L32 38 Z" fill="#e24b4b" />
          <path d="M48 38 A16 16 0 0 1 32 54 L32 38 Z" fill="#e2b325" />
          <path d="M32 54 A16 16 0 0 1 16 38 L32 38 Z" fill="#1f8a4c" />
          <path d="M16 38 A16 16 0 0 1 32 22 L32 38 Z" fill="#2f6fe0" />
          <text x="32" y="76" textAnchor="middle" fill="#f3efe6" fontSize="18" fontWeight="800" fontFamily="Segoe UI,system-ui,sans-serif">
            +4
          </text>
        </svg>
      </span>
    );
  }

  return (
    <span className="special-face wild" aria-hidden="true">
      <svg viewBox="0 0 64 96" className="special-svg">
        <rect x="2" y="2" width="60" height="92" rx="10" fill="#121212" stroke="#f3efe6" strokeWidth="2" />
        <circle cx="32" cy="40" r="17" fill="#1a1a1a" />
        <path d="M32 23 A17 17 0 0 1 49 40 L32 40 Z" fill="#e24b4b" />
        <path d="M49 40 A17 17 0 0 1 32 57 L32 40 Z" fill="#e2b325" />
        <path d="M32 57 A17 17 0 0 1 15 40 L32 40 Z" fill="#1f8a4c" />
        <path d="M15 40 A17 17 0 0 1 32 23 L32 40 Z" fill="#2f6fe0" />
        <circle cx="32" cy="40" r="4.5" fill="#f3efe6" />
        <text x="32" y="78" textAnchor="middle" fill="#f3efe6" fontSize="11" fontWeight="800" fontFamily="Segoe UI,system-ui,sans-serif" letterSpacing="1.2">
          WILD
        </text>
      </svg>
    </span>
  );
}

function SeatPad({
  seat,
  place,
  missing,
  onToggle,
  onClear,
}: {
  seat: OppSeat;
  place: 'across' | 'left' | 'right';
  missing: Color[];
  onToggle: (color: Color) => void;
  onClear: () => void;
}) {
  const outCount = missing.length;
  return (
    <article className={`seat-pad pos-${place} ${outCount > 0 ? 'has-voids' : ''}`}>
      <div className="seat-pad-head">
        <span className="seat-avatar" aria-hidden="true">
          {SEAT_NAMES[seat].slice(0, 1)}
        </span>
        <div className="seat-pad-copy">
          <p className="kicker">{SEAT_NAMES[seat]}</p>
          <p className="void-summary">
            {outCount === 0 ? 'All colors in' : `${outCount} out`}
          </p>
        </div>
        <button type="button" className="seat-clear" onClick={onClear} disabled={outCount === 0}>
          Clear
        </button>
      </div>
      <div className="color-toggles" role="group" aria-label={`${SEAT_NAMES[seat]} colors`}>
        {COLORS.map((color) => {
          const out = missing.includes(color);
          return (
            <button
              key={color}
              type="button"
              className={`void-chip ${out ? 'is-out' : 'is-has'}`}
              data-color={color}
              aria-pressed={out}
              onClick={() => onToggle(color)}
            >
              <span className="void-swatch" data-color={color} aria-hidden="true" />
              <span className="void-name">{colorName(color)}</span>
              <span className={`void-state ${out ? 'out' : 'has'}`}>{out ? 'Out' : 'Has'}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}
