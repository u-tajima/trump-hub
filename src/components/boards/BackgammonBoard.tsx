import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dices, LogOut } from 'lucide-react';
import type { BackgammonClientState } from '../../games/backgammon';
import { GameDice3DTray } from '../GameDice3DTray';

interface BackgammonBoardProps {
  state: BackgammonClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

const DIE_PIPS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [
    [28, 28],
    [72, 72],
  ],
  3: [
    [28, 28],
    [50, 50],
    [72, 72],
  ],
  4: [
    [28, 28],
    [72, 28],
    [28, 72],
    [72, 72],
  ],
  5: [
    [28, 28],
    [72, 28],
    [50, 50],
    [28, 72],
    [72, 72],
  ],
  6: [
    [28, 24],
    [72, 24],
    [28, 50],
    [72, 50],
    [28, 76],
    [72, 76],
  ],
};

const MiniDie: React.FC<{ value: number; used?: boolean }> = ({ value, used = false }) => (
  <svg
    viewBox="0 0 100 100"
    width={30}
    height={30}
    style={{
      opacity: used ? 0.32 : 1,
      filter: used ? 'grayscale(0.8)' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.45))',
      transition: 'opacity 0.15s ease',
    }}
    aria-label={`サイコロ ${value}`}
  >
    <rect
      x={6}
      y={6}
      width={88}
      height={88}
      rx={18}
      fill="#f8fafc"
      stroke="#cbd5e1"
      strokeWidth={4}
    />
    {(DIE_PIPS[value] ?? []).map(([cx, cy], idx) => (
      <circle
        key={idx}
        cx={cx}
        cy={cy}
        r={9.5}
        fill={value === 1 ? '#dc2626' : '#0f172a'}
      />
    ))}
  </svg>
);

export const BackgammonBoard: React.FC<BackgammonBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [manualFrom, setManualFrom] = useState<number | 'bar' | null>(null);
  const [rollSeq, setRollSeq] = useState<number>(0);
  const [displayDice, setDisplayDice] = useState<[number, number]>(
    state.dice ? [state.dice[0], state.dice[1]] : [3, 5]
  );
  const prevDiceRef = useRef<[number, number] | null>(state.dice);
  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const winner = state.players.find((p) => p.id === state.winnerId);

  // 新しい state.dice が確定したタイミングで3D物理ロールを発火
  useEffect(() => {
    if (state.dice && state.dice !== prevDiceRef.current) {
      setDisplayDice([state.dice[0], state.dice[1]]);
      setRollSeq((seq) => seq + 1);
    }
    prevDiceRef.current = state.dice;
  }, [state.dice]);

  // 動かせる移動元セット
  const movableFromSet = useMemo(() => {
    const set = new Set<number | 'bar'>();
    if (!isMyTurn || state.subPhase !== 'move') return set;
    for (const m of state.validMoves) {
      set.add(m.from);
    }
    return set;
  }, [isMyTurn, state.subPhase, state.validMoves]);

  // バーに駒があるときは自動で 'bar' を選択状態に
  const selectedFrom: number | 'bar' | null = useMemo(() => {
    if (!isMyTurn || state.subPhase !== 'move') return null;
    if (movableFromSet.has('bar')) return 'bar';
    if (manualFrom !== null && movableFromSet.has(manualFrom)) return manualFrom;
    return null;
  }, [isMyTurn, state.subPhase, movableFromSet, manualFrom]);

  // 選択中の移動元から行ける移動先マップ
  const targetMap = useMemo(() => {
    const map = new Map<number | 'off', boolean>(); // to -> isHit
    if (selectedFrom === null) return map;
    for (const m of state.validMoves) {
      if (m.from === selectedFrom) {
        map.set(m.to, m.isHit);
      }
    }
    return map;
  }, [selectedFrom, state.validMoves]);

  const handlePointClick = (idx: number) => {
    if (!isMyTurn || state.subPhase !== 'move') return;

    if (selectedFrom !== null && targetMap.has(idx)) {
      setManualFrom(null);
      onAction({ type: 'move', payload: { from: selectedFrom, to: idx } });
      return;
    }

    if (movableFromSet.has(idx)) {
      setManualFrom((prev) => (prev === idx ? null : idx));
      return;
    }

    setManualFrom(null);
  };

  const handleBarClick = () => {
    if (!isMyTurn || state.subPhase !== 'move') return;
    if (movableFromSet.has('bar')) {
      setManualFrom('bar');
    }
  };

  const handleBearOffClick = () => {
    if (!isMyTurn || state.subPhase !== 'move') return;
    if (selectedFrom !== null && targetMap.has('off')) {
      setManualFrom(null);
      onAction({ type: 'move', payload: { from: selectedFrom, to: 'off' } });
    }
  };

  // ダイス表示用（使用済み vs 未使用を判定）
  const diceDisplay = useMemo(() => {
    if (!state.dice) return [];
    const [d1, d2] = state.dice;
    const all = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
    const rem = [...state.remainingDice];
    return all.map((val) => {
      const idx = rem.indexOf(val);
      if (idx >= 0) {
        rem.splice(idx, 1);
        return { val, used: false };
      }
      return { val, used: true };
    });
  }, [state.dice, state.remainingDice]);

  // 上段: 12..17 (左), 18..23 (右) / 下段: 11..6 (左), 5..0 (右)
  const topLeft = [12, 13, 14, 15, 16, 17];
  const topRight = [18, 19, 20, 21, 22, 23];
  const bottomLeft = [11, 10, 9, 8, 7, 6];
  const bottomRight = [5, 4, 3, 2, 1, 0];

  const renderPoint = (idx: number, isTop: boolean) => {
    const val = state.points[idx];
    const owner: 0 | 1 | null = val > 0 ? 0 : val < 0 ? 1 : null;
    const count = Math.abs(val);
    const isSource = movableFromSet.has(idx);
    const isSelected = selectedFrom === idx;
    const isTarget = targetMap.has(idx);
    const isHitTarget = targetMap.get(idx) === true;
    const interactive = isSource || isTarget;
    const isEven = idx % 2 === 0;
    const triColor = isTarget
      ? isHitTarget
        ? '#b45309'
        : '#15803d'
      : isEven
      ? '#7c3f1d'
      : '#c9a679';

    const visibleStack = Math.min(count, 5);

    return (
      <button
        key={idx}
        type="button"
        disabled={!interactive}
        onClick={() => handlePointClick(idx)}
        aria-label={`ポイント ${idx + 1}`}
        style={{
          position: 'relative',
          height: 118,
          border: 'none',
          padding: 0,
          background: isSelected ? 'rgba(250, 204, 21, 0.22)' : 'transparent',
          cursor: interactive ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: isTop ? 'column' : 'column-reverse',
          alignItems: 'center',
          justifyContent: 'flex-start',
          overflow: 'visible',
        }}
      >
        {/* 三角ポイント SVG */}
        <svg
          viewBox="0 0 36 100"
          preserveAspectRatio="none"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '86%',
            top: isTop ? 0 : undefined,
            bottom: isTop ? undefined : 0,
            pointerEvents: 'none',
          }}
        >
          <polygon
            points={isTop ? '2,0 34,0 18,98' : '2,100 34,100 18,2'}
            fill={triColor}
            opacity={isTarget ? 0.95 : 0.88}
          />
        </svg>

        {/* 駒のスタック */}
        <div
          style={{
            position: 'relative',
            zIndex: 2,
            display: 'flex',
            flexDirection: isTop ? 'column' : 'column-reverse',
            alignItems: 'center',
            gap: 1,
            paddingTop: isTop ? 3 : 0,
            paddingBottom: isTop ? 0 : 3,
          }}
        >
          {owner !== null &&
            Array.from({ length: visibleStack }, (_, i) => {
              const isTopStone = i === visibleStack - 1;
              return (
                <span
                  key={i}
                  style={{
                    width: 21,
                    height: 21,
                    borderRadius: '50%',
                    background:
                      owner === 0
                        ? 'radial-gradient(circle at 35% 30%, #fef3c7, #f59e0b 65%, #92400e)'
                        : 'radial-gradient(circle at 35% 30%, #64748b, #1e293b 65%, #020617)',
                    border:
                      isTopStone && isSelected
                        ? '2px solid #fde047'
                        : isTopStone && isSource
                        ? '2px solid #86efac'
                        : owner === 0
                        ? '1.5px solid #fde68a'
                        : '1.5px solid #94a3b8',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.48)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 900,
                    color: owner === 0 ? '#451a03' : '#f8fafc',
                    lineHeight: 1,
                  }}
                >
                  {isTopStone && count > 5 ? count : ''}
                </span>
              );
            })}
        </div>

        {/* 移動先インジケータ */}
        {isTarget && (
          <span
            style={{
              position: 'absolute',
              zIndex: 3,
              top: isTop ? '68%' : undefined,
              bottom: isTop ? undefined : '68%',
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: isHitTarget ? '#facc15' : '#4ade80',
              border: '1.5px solid #0f172a',
              boxShadow: '0 0 8px rgba(74, 222, 128, 0.8)',
            }}
          />
        )}
      </button>
    );
  };

  const canBearOffNow = selectedFrom !== null && targetMap.has('off');

  return (
    <div className="board-container">
      {/* プレイヤーバー */}
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && current.id === p.id;
          const isAmber = p.side === 0;
          return (
            <div
              key={p.id}
              className={`opp-pill ${active ? 'active' : ''} ${
                !isLocalPassAndPlay && p.id === state.myId ? 'me' : ''
              }`}
              style={active ? { borderColor: isAmber ? '#f59e0b' : '#94a3b8' } : undefined}
            >
              <div
                className="opp-name"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: isAmber ? '#f59e0b' : '#1e293b',
                    border: `1.5px solid ${isAmber ? '#fde68a' : '#cbd5e1'}`,
                    flexShrink: 0,
                  }}
                />
                <span>{p.name}</span>
              </div>
              <div className="opp-meta">
                {state.rules.targetPoints > 1
                  ? `${state.scores[p.side]}/${state.rules.targetPoints}pt・`
                  : ''}
                済{state.borneOff[p.side]}/15 (PIP {state.pipCounts[p.side]})
              </div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* バックギャモン盤 */}
      <div
        className="board-center-wrap"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          width: '100%',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 404,
            background: 'linear-gradient(180deg, #1b3b28 0%, #11291b 100%)',
            border: '4px solid #4a2a14',
            borderRadius: 14,
            padding: 6,
            boxShadow: '0 10px 26px rgba(0,0,0,0.5), inset 0 0 14px rgba(0,0,0,0.45)',
          }}
        >
          {/* 上段 (12..17 | BAR | 18..23) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, minmax(0, 1fr)) 28px repeat(6, minmax(0, 1fr))',
              gap: 1,
            }}
          >
            {topLeft.map((idx) => renderPoint(idx, true))}

            {/* 上部バー（P1のヒット駒） */}
            <button
              type="button"
              disabled={!movableFromSet.has('bar') || current.side !== 1}
              onClick={handleBarClick}
              aria-label="バー（後手）"
              style={{
                background:
                  selectedFrom === 'bar' && current.side === 1
                    ? 'rgba(250, 204, 21, 0.3)'
                    : 'rgba(58, 32, 16, 0.85)',
                border: 'none',
                borderLeft: '1px solid rgba(255,255,255,0.1)',
                borderRight: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                padding: 0,
                cursor:
                  movableFromSet.has('bar') && current.side === 1 ? 'pointer' : 'default',
              }}
            >
              {state.bar[1] > 0 && (
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#1e293b',
                    border:
                      selectedFrom === 'bar' && current.side === 1
                        ? '2px solid #fde047'
                        : '1.5px solid #cbd5e1',
                    color: '#f8fafc',
                    fontSize: 10,
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {state.bar[1]}
                </span>
              )}
            </button>

            {topRight.map((idx) => renderPoint(idx, true))}
          </div>

          {/* 中央ストリップ（ダイス＆方向ヒント） */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              margin: '2px 0',
              background: 'rgba(0, 0, 0, 0.28)',
              borderRadius: 8,
              minHeight: 40,
            }}
          >
            <div style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 700 }}>
              {current.side === 0 ? '先手(金): 右下→右上へ' : '後手(黒): 右上→右下へ'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {diceDisplay.length > 0 ? (
                diceDisplay.map((d, i) => <MiniDie key={i} value={d.val} used={d.used} />)
              ) : (
                <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>
                  ダイス待機中
                </span>
              )}
            </div>
          </div>

          {/* 下段 (11..6 | BAR | 5..0) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, minmax(0, 1fr)) 28px repeat(6, minmax(0, 1fr))',
              gap: 1,
            }}
          >
            {bottomLeft.map((idx) => renderPoint(idx, false))}

            {/* 下部バー（P0のヒット駒） */}
            <button
              type="button"
              disabled={!movableFromSet.has('bar') || current.side !== 0}
              onClick={handleBarClick}
              aria-label="バー（先手）"
              style={{
                background:
                  selectedFrom === 'bar' && current.side === 0
                    ? 'rgba(250, 204, 21, 0.3)'
                    : 'rgba(58, 32, 16, 0.85)',
                border: 'none',
                borderLeft: '1px solid rgba(255,255,255,0.1)',
                borderRight: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                padding: 0,
                cursor:
                  movableFromSet.has('bar') && current.side === 0 ? 'pointer' : 'default',
              }}
            >
              {state.bar[0] > 0 && (
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: '#f59e0b',
                    border:
                      selectedFrom === 'bar' && current.side === 0
                        ? '2px solid #fde047'
                        : '1.5px solid #fef3c7',
                    color: '#451a03',
                    fontSize: 10,
                    fontWeight: 900,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {state.bar[0]}
                </span>
              )}
            </button>

            {bottomRight.map((idx) => renderPoint(idx, false))}
          </div>
        </div>

        {/* 3D物理ダイストレイ */}
        <div style={{ width: '100%', maxWidth: 404 }}>
          <GameDice3DTray
            dice={displayDice}
            rollTrigger={rollSeq}
            dimmed={state.subPhase === 'roll'}
            height={88}
          />
        </div>

        {/* アクションバー（ダイスロール / ベアオフ） */}
        {state.phase === 'playing' && (
          <div
            className="action-bar sticky-bottom-bar"
            style={{ width: '100%', maxWidth: 404, justifyContent: 'center' }}
          >
            {isMyTurn && state.subPhase === 'roll' && (
              <button
                type="button"
                className="primary-btn flex-1"
                onClick={() => onAction({ type: 'roll' })}
              >
                <Dices size={17} /> ダイスを振る
              </button>
            )}

            {isMyTurn && state.subPhase === 'move' && canBearOffNow && (
              <button
                type="button"
                className="primary-btn flex-1"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                onClick={handleBearOffClick}
              >
                <LogOut size={16} /> 選択した駒をベアオフ（ゴール）
              </button>
            )}

            {isMyTurn && state.subPhase === 'move' && !canBearOffNow && (
              <div style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 700, padding: '6px 0' }}>
                {selectedFrom !== null
                  ? '緑（または黄）の移動先ポイントをタップ'
                  : '緑枠の駒をタップして移動先を選んでください'}
              </div>
            )}
          </div>
        )}
      </div>

      {state.phase === 'finished' && (
        <div className="result-card">
          <h3>
            {isLocalPassAndPlay
              ? `${winner?.name ?? ''} の勝利！`
              : state.winnerId === state.myId
              ? 'あなたの勝利！'
              : `${winner?.name ?? '相手'} の勝利…`}
          </h3>
          <p className="panel-desc">
            スコア: {state.players[0].name} {state.scores[0]} - {state.scores[1]}{' '}
            {state.players[1].name}
          </p>
        </div>
      )}
    </div>
  );
};
