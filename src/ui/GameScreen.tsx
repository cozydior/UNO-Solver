import { useMemo, useState } from 'react';
import { COLORS, Color, SEAT_NAMES, applyMatchFee, colorName, formatCoins } from '../money';

type OppSeat = 1 | 2 | 3;
type Voids = Record<OppSeat, Color[]>;

const emptyVoids = (): Voids => ({ 1: [], 2: [], 3: [] });
const WILD_START = 4;
const PLUS4_START = 4;

/** Left is next clockwise from you, so their voids weigh most. */
const SEAT_WEIGHT: Record<OppSeat, number> = { 1: 3, 2: 2, 3: 1 };

export function GameScreen({
  coins,
  fee,
  roomLabel,
  onBack,
  onFinish,
}: {
  coins: number;
  fee: number;
  roomLabel: string;
  onBack: () => void;
  onFinish: (matchResult: number) => void;
}) {
  const [voids, setVoids] = useState<Voids>(emptyVoids);
  const [wildLeft, setWildLeft] = useState(WILD_START);
  const [plus4Left, setPlus4Left] = useState(PLUS4_START);
  const [ending, setEnding] = useState(false);
  const [delta, setDelta] = useState('');
  const advice = useMemo(() => recommendPlayColor(voids), [voids]);

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

  return (
    <div className="game">
      <header className="topbar">
        <button type="button" onClick={onBack}>
          Home
        </button>
        <div>
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

      <section className="felt" aria-label="Table">
        <WildCounter
          kind="wild"
          place="wild"
          left={wildLeft}
          total={WILD_START}
          onPlayed={() => setWildLeft((n) => Math.max(0, n - 1))}
          onUndo={() => setWildLeft((n) => Math.min(WILD_START, n + 1))}
        />
        <SeatPad
          seat={2}
          place="across"
          missing={voids[2]}
          playColor={advice.color}
          onToggle={(color) => toggle(2, color)}
          onClear={() => clearSeat(2)}
        />
        <WildCounter
          kind="plus4"
          place="plus4"
          left={plus4Left}
          total={PLUS4_START}
          onPlayed={() => setPlus4Left((n) => Math.max(0, n - 1))}
          onUndo={() => setPlus4Left((n) => Math.min(PLUS4_START, n + 1))}
        />
        <SeatPad
          seat={1}
          place="left"
          missing={voids[1]}
          playColor={advice.color}
          onToggle={(color) => toggle(1, color)}
          onClear={() => clearSeat(1)}
        />
        <div className={`felt-center ${advice.color ? 'has-call' : ''}`} data-color={advice.color ?? undefined}>
          <p className="kicker">Play this color</p>
          <p className="play-now">{advice.color ? colorName(advice.color) : '—'}</p>
          <p className="play-reason">{advice.reason}</p>
          <div className="play-colors" aria-hidden="true">
            {COLORS.map((color) => (
              <span
                key={color}
                className={`play-swatch ${advice.color === color ? 'is-on' : ''}`}
                data-color={color}
              />
            ))}
          </div>
        </div>
        <SeatPad
          seat={3}
          place="right"
          missing={voids[3]}
          playColor={advice.color}
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
              Enter the match result before the entry fee. Entry fee −{formatCoins(fee)} is always deducted.
            </p>
            <input
              className="delta"
              inputMode="text"
              aria-label="Match coins won or lost"
              placeholder="400 or -200"
              value={delta}
              onChange={(event) => setDelta(event.target.value)}
              autoFocus
            />
            {ready ? (
              <div className="fee-preview">
                <p className="quiet">
                  Match {matchResult >= 0 ? '+' : ''}
                  {formatCoins(matchResult)} − fee {formatCoins(fee)} ={' '}
                  <span className={net >= 0 ? 'good-text' : 'warn'}>
                    {net >= 0 ? '+' : ''}
                    {formatCoins(net)}
                  </span>
                </p>
                <p className={net >= 0 ? 'good-text' : 'warn'}>
                  Bankroll becomes {formatCoins(coins + net)}
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
  place,
  left,
  total,
  onPlayed,
  onUndo,
}: {
  kind: 'wild' | 'plus4';
  place: 'wild' | 'plus4';
  left: number;
  total: number;
  onPlayed: () => void;
  onUndo: () => void;
}) {
  const label = kind === 'wild' ? 'Wild' : '+4';
  return (
    <div className={`special-track pos-${place} ${kind} ${left === 0 ? 'is-empty' : ''}`}>
      <button
        type="button"
        className="special-hit"
        disabled={left <= 0}
        onClick={onPlayed}
        aria-label={`${label} played, ${left} left`}
      >
        <SpecialFace kind={kind} />
        <span className="special-count">{left}</span>
        <span className="special-label">{label}</span>
        <span className="special-hint">{left === 0 ? 'Gone' : 'Tap played'}</span>
      </button>
      <div className="special-pips" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <span key={index} className={`special-pip ${index < left ? 'is-left' : 'is-gone'}`} />
        ))}
      </div>
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
          <defs>
            <linearGradient id="plus4Shine" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2a2a2a" />
              <stop offset="100%" stopColor="#0d0d0d" />
            </linearGradient>
          </defs>
          <rect x="2" y="2" width="60" height="92" rx="9" fill="url(#plus4Shine)" stroke="#f3efe6" strokeWidth="2.2" />
          <rect x="8" y="10" width="48" height="54" rx="6" fill="#101010" stroke="rgba(243,239,230,0.2)" strokeWidth="1" />
          <g transform="translate(32 37)">
            <rect x="-13" y="-16" width="12" height="18" rx="2" fill="#e24b4b" transform="rotate(-18)" />
            <rect x="1" y="-18" width="12" height="18" rx="2" fill="#e2b325" transform="rotate(8)" />
            <rect x="-10" y="-2" width="12" height="18" rx="2" fill="#2f6fe0" transform="rotate(-6)" />
            <rect x="4" y="0" width="12" height="18" rx="2" fill="#1f8a4c" transform="rotate(16)" />
          </g>
          <circle cx="32" cy="74" r="12" fill="#f3efe6" />
          <text x="32" y="79" textAnchor="middle" fill="#12130f" fontSize="13" fontWeight="800" fontFamily="Segoe UI,system-ui,sans-serif">
            +4
          </text>
        </svg>
      </span>
    );
  }

  return (
    <span className="special-face wild" aria-hidden="true">
      <svg viewBox="0 0 64 96" className="special-svg">
        <rect x="2" y="2" width="60" height="92" rx="9" fill="#141414" stroke="#f3efe6" strokeWidth="2.2" />
        <circle cx="32" cy="42" r="18" fill="#1a1a1a" />
        <path d="M32 24 A18 18 0 0 1 50 42 L32 42 Z" fill="#e24b4b" />
        <path d="M50 42 A18 18 0 0 1 32 60 L32 42 Z" fill="#e2b325" />
        <path d="M32 60 A18 18 0 0 1 14 42 L32 42 Z" fill="#1f8a4c" />
        <path d="M14 42 A18 18 0 0 1 32 24 L32 42 Z" fill="#2f6fe0" />
        <circle cx="32" cy="42" r="5" fill="#f3efe6" />
        <text x="32" y="78" textAnchor="middle" fill="#f3efe6" fontSize="11" fontWeight="800" fontFamily="Segoe UI,system-ui,sans-serif" letterSpacing="1">
          WILD
        </text>
      </svg>
    </span>
  );
}

function recommendPlayColor(voids: Voids): { color: Color | null; reason: string } {
  const scores: Record<Color, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const seat of [1, 2, 3] as OppSeat[]) {
    for (const color of voids[seat]) scores[color] += SEAT_WEIGHT[seat];
  }

  const ranked = COLORS.map((color) => ({ color, score: scores[color] })).sort(
    (a, b) => b.score - a.score || COLORS.indexOf(a.color) - COLORS.indexOf(b.color),
  );
  const best = ranked[0];
  if (!best || best.score === 0) {
    return { color: null, reason: 'Mark who passed a color. Left weighs most.' };
  }

  const who = ([1, 2, 3] as OppSeat[])
    .filter((seat) => voids[seat].includes(best.color))
    .map((seat) => SEAT_NAMES[seat]);
  const count = who.length;
  const reason =
    count === 3
      ? `All three are out of ${colorName(best.color)}.`
      : count === 1 && who[0] === 'Left'
        ? `Left is out — strongest next-seat call.`
        : `${who.join(' · ')} out of ${colorName(best.color)}.`;

  return { color: best.color, reason };
}

function SeatPad({
  seat,
  place,
  missing,
  playColor,
  onToggle,
  onClear,
}: {
  seat: OppSeat;
  place: 'across' | 'left' | 'right';
  missing: Color[];
  playColor: Color | null;
  onToggle: (color: Color) => void;
  onClear: () => void;
}) {
  return (
    <article className={`seat-pad pos-${place} ${missing.length > 0 ? 'has-voids' : ''}`}>
      <div className="seat-pad-head">
        <span className="seat-avatar" aria-hidden="true">
          {SEAT_NAMES[seat].slice(0, 1)}
        </span>
        <div>
          <p className="kicker">{SEAT_NAMES[seat]}</p>
          <p className="void-summary">
            {missing.length === 0 ? 'All colors possible' : `Out: ${missing.map((color) => colorName(color)).join(', ')}`}
          </p>
        </div>
        <button type="button" onClick={onClear} disabled={missing.length === 0}>
          Clear
        </button>
      </div>
      <div className="color-toggles" role="group" aria-label={`${SEAT_NAMES[seat]} colors`}>
        {COLORS.map((color) => {
          const out = missing.includes(color);
          const live = playColor === color;
          return (
            <button
              key={color}
              type="button"
              className={`void-chip ${out ? 'is-out' : 'is-has'} ${live ? 'is-live' : ''}`}
              data-color={color}
              aria-pressed={out}
              onClick={() => onToggle(color)}
            >
              <span className="void-dot" data-color={color} />
              <span className="void-name">{colorName(color)}</span>
              <span className={`void-state ${out ? 'out' : 'has'}`}>{out ? 'Out' : 'Has'}</span>
            </button>
          );
        })}
      </div>
    </article>
  );
}
