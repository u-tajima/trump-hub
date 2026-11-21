import React, { useEffect, useRef, useState } from 'react';
import { Dices, Hand, Trophy } from 'lucide-react';
import type { ChinchiroClientState } from '../../games/chinchiro';
import { Dice3D, DiceCube3D, FACE_TARGET_ROTATION } from '../Dice3D';

interface ChinchiroBoardProps {
  state: ChinchiroClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

interface DieBody {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  wx: number;
  wy: number;
  wz: number;
}

type SimMode = 'idle' | 'shaking' | 'settling';

const BOWL_RADIUS = 72;
const DIE_RADIUS = 21;
const REST_SLOTS: [number, number][] = [
  [-44, 12],
  [0, -22],
  [44, 14],
];

function createInitialBodies(): [DieBody, DieBody, DieBody] {
  return REST_SLOTS.map(([x, y], idx) => {
    const rot = FACE_TARGET_ROTATION[idx + 1];
    return {
      x,
      y,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      rx: rot.rx,
      ry: rot.ry,
      rz: rot.rz,
      wx: 0,
      wy: 0,
      wz: 0,
    };
  }) as [DieBody, DieBody, DieBody];
}

function nearestTargetAngle(current: number, targetBase: number, extraTurns = 1): number {
  const full = Math.round((current - targetBase) / 360) * 360 + targetBase;
  return full + 360 * extraTurns;
}

export const ChinchiroBoard: React.FC<ChinchiroBoardProps> = ({ state, onAction }) => {
  const [simMode, setSimMode] = useState<SimMode>('idle');
  const [bodies, setBodies] = useState<[DieBody, DieBody, DieBody]>(() => createInitialBodies());
  const [bowlPos, setBowlPos] = useState<{ x: number; y: number; rot: number }>({ x: 0, y: 0, rot: 0 });
  const [bowlLabel, setBowlLabel] = useState<string>('茶碗を振ってスタート');

  const simModeRef = useRef<SimMode>('idle');
  const bodiesRef = useRef<[DieBody, DieBody, DieBody]>(bodies);
  const targetDiceRef = useRef<[number, number, number]>([1, 2, 3]);
  const targetAnglesRef = useRef<{ rx: number; ry: number; rz: number }[]>([]);
  const settleStartRef = useRef<number>(0);
  const awaitingResultRef = useRef<boolean>(false);
  const prevLogRef = useRef<string>(state.lastLog);
  const pendingLabelRef = useRef<string>('');

  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const dealer = state.players[state.dealerIndex];

  const activeHand =
    current.currentHand ??
    state.players.find((p) => p.currentHand !== null)?.currentHand ??
    null;

  useEffect(() => {
    if (prevLogRef.current === state.lastLog) return;
    prevLogRef.current = state.lastLog;

    const dice: [number, number, number] = activeHand?.dice ?? [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
    ];
    targetDiceRef.current = dice;
    pendingLabelRef.current = activeHand?.label ?? state.lastLog;

    const beginSettle = () => {
      targetAnglesRef.current = dice.map((val, idx) => {
        const base = FACE_TARGET_ROTATION[val] ?? FACE_TARGET_ROTATION[1];
        const b = bodiesRef.current[idx];
        return {
          rx: nearestTargetAngle(b.rx, base.rx, 1),
          ry: nearestTargetAngle(b.ry, base.ry, 1),
          rz: nearestTargetAngle(b.rz, base.rz, 0),
        };
      });
      settleStartRef.current = performance.now();
      simModeRef.current = 'settling';
      setSimMode('settling');
      setBowlPos({ x: 0, y: 0, rot: 0 });
      setBowlLabel('出目を判定中…');
    };

    if (awaitingResultRef.current) {
      awaitingResultRef.current = false;
      beginSettle();
    } else {
      bodiesRef.current = bodiesRef.current.map((b) => ({
        ...b,
        vx: (Math.random() - 0.5) * 420,
        vy: (Math.random() - 0.5) * 420,
        vz: 140 + Math.random() * 100,
        wx: 520 + Math.random() * 320,
        wy: 480 + Math.random() * 320,
        wz: 360 + Math.random() * 240,
      })) as [DieBody, DieBody, DieBody];
      simModeRef.current = 'shaking';
      setSimMode('shaking');
      setBowlLabel('茶碗を振っています…');
      const timer = window.setTimeout(beginSettle, 750);
      return () => window.clearTimeout(timer);
    }
  }, [state.lastLog]);

  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.033, (now - lastTime) / 1000);
      lastTime = now;
      const mode = simModeRef.current;

      if (mode === 'shaking') {
        const t = now / 1000;
        const bx = Math.sin(t * 24) * 11;
        const by = Math.cos(t * 19) * 7;
        const brot = Math.sin(t * 20) * 5;
        setBowlPos({ x: bx, y: by, rot: brot });

        const next = bodiesRef.current.map((b) => {
          let { x, y, z, vx, vy, vz, rx, ry, rz, wx, wy, wz } = b;
          vx += Math.cos(t * 24) * 900 * dt + (Math.random() - 0.5) * 700 * dt;
          vy += Math.sin(t * 19) * 900 * dt + (Math.random() - 0.5) * 700 * dt;
          vz -= 980 * dt;

          x += vx * dt;
          y += vy * dt;
          z += vz * dt;

          if (z <= 0) {
            z = 0;
            vz = 90 + Math.random() * 140;
            wx = (Math.random() - 0.5) * 900;
            wy = (Math.random() - 0.5) * 900;
          }

          const dist = Math.hypot(x, y);
          const maxR = BOWL_RADIUS - DIE_RADIUS;
          if (dist > maxR && dist > 0.001) {
            const nx = x / dist;
            const ny = y / dist;
            x = nx * maxR;
            y = ny * maxR;
            const dot = vx * nx + vy * ny;
            if (dot > 0) {
              vx = (vx - 2 * dot * nx) * 0.85;
              vy = (vy - 2 * dot * ny) * 0.85;
            }
          }

          rx += wx * dt;
          ry += wy * dt;
          rz += wz * dt;

          return { x, y, z, vx: vx * 0.985, vy: vy * 0.985, vz, rx, ry, rz, wx, wy, wz };
        }) as [DieBody, DieBody, DieBody];

        for (let i = 0; i < 3; i++) {
          for (let j = i + 1; j < 3; j++) {
            const a = next[i];
            const b = next[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const d = Math.hypot(dx, dy);
            const minD = DIE_RADIUS * 1.95;
            if (d < minD && d > 0.001) {
              const nx = dx / d;
              const ny = dy / d;
              const overlap = (minD - d) * 0.5;
              a.x -= nx * overlap;
              a.y -= ny * overlap;
              b.x += nx * overlap;
              b.y += ny * overlap;

              const dvx = a.vx - b.vx;
              const dvy = a.vy - b.vy;
              const rel = dvx * nx + dvy * ny;
              if (rel > 0) {
                a.vx -= rel * nx * 0.9;
                a.vy -= rel * ny * 0.9;
                b.vx += rel * nx * 0.9;
                b.vy += rel * ny * 0.9;
              }
            }
          }
        }

        bodiesRef.current = next;
        setBodies(next);
      } else if (mode === 'settling') {
        const elapsed = now - settleStartRef.current;
        const delays = [0, 180, 360];
        const duration = 620;
        let allDone = true;

        const next = bodiesRef.current.map((b, idx) => {
          const localElapsed = Math.max(0, elapsed - delays[idx]);
          const p = Math.min(1, localElapsed / duration);
          if (p < 1) allDone = false;

          const ease = 1 - Math.pow(1 - p, 3);
          const [tx, ty] = REST_SLOTS[idx];
          const target = targetAnglesRef.current[idx] ?? { rx: 0, ry: 0, rz: 0 };
          const bounceZ = p < 1 ? Math.abs(Math.sin(p * Math.PI * 2.5)) * (1 - p) * 28 : 0;

          return {
            ...b,
            x: b.x + (tx - b.x) * Math.min(1, ease * 0.25 + (p === 1 ? 1 : 0)),
            y: b.y + (ty - b.y) * Math.min(1, ease * 0.25 + (p === 1 ? 1 : 0)),
            z: bounceZ,
            rx: b.rx + (target.rx - b.rx) * Math.min(1, ease * 0.28 + (p === 1 ? 1 : 0)),
            ry: b.ry + (target.ry - b.ry) * Math.min(1, ease * 0.28 + (p === 1 ? 1 : 0)),
            rz: b.rz + (target.rz - b.rz) * Math.min(1, ease * 0.28 + (p === 1 ? 1 : 0)),
          };
        }) as [DieBody, DieBody, DieBody];

        bodiesRef.current = next;
        setBodies(next);

        if (allDone) {
          simModeRef.current = 'idle';
          setSimMode('idle');
          setBowlLabel(pendingLabelRef.current || '確定！');
        }
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const handleStartShake = () => {
    if (!isMyTurn || simMode !== 'idle') return;
    bodiesRef.current = bodiesRef.current.map((b) => ({
      ...b,
      vx: (Math.random() - 0.5) * 480,
      vy: (Math.random() - 0.5) * 480,
      vz: 160 + Math.random() * 120,
      wx: 640 + Math.random() * 360,
      wy: 580 + Math.random() * 360,
      wz: 420 + Math.random() * 260,
    })) as [DieBody, DieBody, DieBody];
    simModeRef.current = 'shaking';
    setSimMode('shaking');
    setBowlLabel('「止める！」で出目を決定');
  };

  const handleStop = () => {
    if (!isMyTurn || simMode !== 'shaking') return;
    awaitingResultRef.current = true;
    onAction({ type: 'roll' });
  };

  return (
    <div className="board-container">
      <div className="status-flags">
        <span className="flag-badge info">
          第 {state.round} / {state.rules.rounds} 局
        </span>
        <span className="flag-badge warn">親: {dealer.name}</span>
      </div>

      <div className="chinchiro-bowl-stage">
        <div
          className="chinchiro-bowl-3d"
          style={{
            transform: `translate3d(${bowlPos.x}px, ${bowlPos.y}px, 0) rotate(${bowlPos.rot}deg)`,
          }}
        >
          <div className="bowl-inner-shadow" />
          {bodies.map((b, idx) => (
            <DiceCube3D key={idx} x={b.x} y={b.y} z={b.z} rx={b.rx} ry={b.ry} rz={b.rz} />
          ))}
        </div>
        <div className={`bowl-result-banner ${simMode === 'idle' && activeHand ? 'pop' : ''}`}>
          {bowlLabel}
        </div>
      </div>

      <div className="chinchiro-players">
        {state.players.map((p, idx) => {
          const active = state.phase === 'playing' && idx === state.turnIndex;
          const isDealer = idx === state.dealerIndex;
          return (
            <div key={p.id} className={`chinchiro-row ${active ? 'active' : ''} ${p.id === state.myId ? 'me' : ''}`}>
              <div className="chinchiro-row-top">
                <div>
                  <strong>{p.name}</strong>
                  {isDealer && <span className="badge host ml-8">親</span>}
                </div>
                <div className="chinchiro-points">
                  {p.points}点
                  {p.lastDelta !== 0 && (
                    <span className={p.lastDelta > 0 ? 'delta-plus' : 'delta-minus'}>
                      {' '}({p.lastDelta > 0 ? `+${p.lastDelta}` : p.lastDelta})
                    </span>
                  )}
                </div>
              </div>
              <div className="chinchiro-row-hand">
                {p.currentHand ? (
                  <>
                    <span className="dice-trio">
                      {p.currentHand.dice.map((d, i) => (
                        <Dice3D key={i} value={d} size="sm" />
                      ))}
                    </span>
                    <span className="hand-label">{p.currentHand.label}</span>
                  </>
                ) : (
                  <span className="text-muted-sm">
                    {active ? `残り ${p.rollsLeft} 回` : '待機中'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {state.phase === 'playing' ? (
        <div className="sticky-bottom-bar">
          {simMode === 'shaking' && isMyTurn ? (
            <button
              type="button"
              className="danger-btn full-width"
              onClick={handleStop}
            >
              <Hand size={18} />
              止める！（出目を決める）
            </button>
          ) : (
            <button
              type="button"
              className="primary-btn full-width"
              disabled={!isMyTurn || simMode !== 'idle'}
              onClick={handleStartShake}
            >
              <Dices size={18} />
              {simMode === 'settling'
                ? '判定中…'
                : simMode === 'shaking'
                ? `${current.name} が振っています…`
                : isMyTurn
                ? `茶碗を振る（残り ${current.rollsLeft} 回）`
                : `${current.name} のターン`}
            </button>
          )}
        </div>
      ) : (
        <div className="result-card">
          <h3>
            <Trophy size={18} /> 最終ランキング
          </h3>
          <ul className="result-list">
            {[...state.players]
              .sort((a, b) => b.points - a.points)
              .map((p, idx) => (
                <li key={p.id}>
                  <span>{idx + 1}位 ({p.points}点)</span>
                  <strong>{p.name}</strong>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};
