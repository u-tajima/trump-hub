import React, { useMemo, useState } from 'react';
import { Hammer, MapPin, Move, X } from 'lucide-react';
import type { TowerClimbClientState, TowerWorker } from '../../games/towerClimb';

interface TowerClimbBoardProps {
  state: TowerClimbClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

const HEIGHT_STYLES: Record<
  number,
  { bg: string; border: string; badgeBg: string; badgeText: string; label: string }
> = {
  0: {
    bg: 'linear-gradient(145deg, #2b4c3d 0%, #1d362b 100%)',
    border: 'rgba(148, 163, 184, 0.25)',
    badgeBg: 'rgba(15, 23, 42, 0.45)',
    badgeText: '#94a3b8',
    label: '0F',
  },
  1: {
    bg: 'linear-gradient(145deg, #d6dde6 0%, #aeb9c9 100%)',
    border: 'rgba(255, 255, 255, 0.55)',
    badgeBg: 'rgba(30, 41, 59, 0.72)',
    badgeText: '#f8fafc',
    label: '1F',
  },
  2: {
    bg: 'linear-gradient(145deg, #f1f5f9 0%, #cbd5e1 100%)',
    border: 'rgba(255, 255, 255, 0.85)',
    badgeBg: 'rgba(15, 23, 42, 0.84)',
    badgeText: '#fde68a',
    label: '2F',
  },
  3: {
    bg: 'linear-gradient(145deg, #fffbeb 0%, #fde68a 100%)',
    border: '#f59e0b',
    badgeBg: '#b45309',
    badgeText: '#ffffff',
    label: '3F',
  },
  4: {
    bg: 'linear-gradient(145deg, #dbeafe 0%, #93c5fd 100%)',
    border: '#3b82f6',
    badgeBg: '#1d4ed8',
    badgeText: '#ffffff',
    label: '封',
  },
};

const DomeSvg: React.FC = () => (
  <svg
    viewBox="0 0 40 40"
    style={{ width: '74%', height: '74%', display: 'block', filter: 'drop-shadow(0 3px 4px rgba(15,23,42,0.45))' }}
    aria-hidden="true"
  >
    <defs>
      <radialGradient id="tower-dome-grad" cx="35%" cy="28%" r="72%">
        <stop offset="0%" stopColor="#93c5fd" />
        <stop offset="48%" stopColor="#2563eb" />
        <stop offset="100%" stopColor="#1e3a8a" />
      </radialGradient>
    </defs>
    <circle cx="20" cy="20" r="16" fill="url(#tower-dome-grad)" stroke="#eff6ff" strokeWidth="2" />
    <ellipse cx="15" cy="14" rx="5" ry="3.2" fill="rgba(255,255,255,0.42)" transform="rotate(-25 15 14)" />
    <circle cx="20" cy="20" r="4" fill="#dbeafe" opacity="0.85" />
  </svg>
);

const WorkerToken: React.FC<{
  owner: 0 | 1;
  selected: boolean;
  activeMover: boolean;
}> = ({ owner, selected, activeMover }) => {
  const isP0 = owner === 0;
  return (
    <span
      style={{
        width: '66%',
        height: '66%',
        borderRadius: '50%',
        background: isP0
          ? 'radial-gradient(circle at 32% 28%, #fef08a 0%, #f59e0b 50%, #c2410c 100%)'
          : 'radial-gradient(circle at 32% 28%, #e0f2fe 0%, #38bdf8 50%, #0369a1 100%)',
        border: selected || activeMover ? '2.5px solid #ffffff' : `2px solid ${isP0 ? '#7c2d12' : '#0c4a6e'}`,
        boxShadow: selected
          ? '0 0 14px rgba(253, 224, 71, 0.9), 0 4px 8px rgba(0,0,0,0.48)'
          : activeMover
          ? '0 0 12px rgba(56, 189, 248, 0.85), 0 4px 8px rgba(0,0,0,0.48)'
          : '0 3px 6px rgba(0,0,0,0.45), inset 0 2px 3px rgba(255,255,255,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: selected ? 'scale(1.08)' : 'scale(1)',
        transition: 'transform 0.12s ease',
      }}
    >
      <span
        style={{
          width: '44%',
          height: '44%',
          borderRadius: '50%',
          background: isP0 ? '#fffbeb' : '#f0f9ff',
          opacity: 0.92,
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.25)',
        }}
      />
    </span>
  );
};

export const TowerClimbBoard: React.FC<TowerClimbBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [rawSelectedWorkerId, setRawSelectedWorkerId] = useState<string | null>(null);
  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const winner = state.players.find((p) => p.id === state.winnerId);

  const workerByCoord = useMemo(() => {
    const map = new Map<string, TowerWorker>();
    for (const w of state.workers) {
      map.set(`${w.row},${w.col}`, w);
    }
    return map;
  }, [state.workers]);

  // 移動フェーズでの選択ワーカー（無効になったら自動クリア）
  const selectedWorkerId = useMemo(() => {
    if (!isMyTurn || state.subPhase !== 'move' || !rawSelectedWorkerId) return null;
    const moves = state.validMovesByWorker[rawSelectedWorkerId];
    return moves && moves.length > 0 ? rawSelectedWorkerId : null;
  }, [isMyTurn, state.subPhase, rawSelectedWorkerId, state.validMovesByWorker]);

  const validMoveTargetSet = useMemo(() => {
    const set = new Set<string>();
    if (!selectedWorkerId) return set;
    for (const m of state.validMovesByWorker[selectedWorkerId] ?? []) {
      set.add(`${m.row},${m.col}`);
    }
    return set;
  }, [selectedWorkerId, state.validMovesByWorker]);

  const validBuildSet = useMemo(() => {
    const set = new Set<string>();
    if (!isMyTurn || state.subPhase !== 'build') return set;
    for (const b of state.validBuilds) {
      set.add(`${b.row},${b.col}`);
    }
    return set;
  }, [isMyTurn, state.subPhase, state.validBuilds]);

  const handleCellClick = (r: number, c: number) => {
    if (!isMyTurn) return;
    const key = `${r},${c}`;
    const worker = workerByCoord.get(key);

    // 1. 初期配置
    if (state.subPhase === 'place') {
      if (!worker) {
        onAction({ type: 'placeWorker', payload: { row: r, col: c } });
      }
      return;
    }

    // 2. 移動フェーズ
    if (state.subPhase === 'move') {
      if (selectedWorkerId && validMoveTargetSet.has(key)) {
        const wId = selectedWorkerId;
        setRawSelectedWorkerId(null);
        onAction({
          type: 'moveWorker',
          payload: { workerId: wId, toRow: r, toCol: c },
        });
        return;
      }

      if (worker && worker.owner === current.side) {
        const moves = state.validMovesByWorker[worker.id] ?? [];
        if (moves.length > 0) {
          setRawSelectedWorkerId((prev) => (prev === worker.id ? null : worker.id));
        }
        return;
      }

      setRawSelectedWorkerId(null);
      return;
    }

    // 3. 建築フェーズ
    if (state.subPhase === 'build') {
      if (validBuildSet.has(key)) {
        onAction({ type: 'build', payload: { row: r, col: c } });
      }
    }
  };

  const stepLabel =
    state.subPhase === 'place'
      ? '配置'
      : state.subPhase === 'move'
      ? '移動'
      : '建築';

  return (
    <div className="board-container">
      {/* プレイヤーバー */}
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && current.id === p.id;
          const isP0 = p.side === 0;
          const accent = isP0 ? '#f59e0b' : '#38bdf8';
          const myWorkers = state.workers.filter((w) => w.owner === p.side);
          const maxH =
            myWorkers.length > 0
              ? Math.max(...myWorkers.map((w) => state.heights[w.row][w.col]))
              : 0;
          return (
            <div
              key={p.id}
              className={`opp-pill ${active ? 'active' : ''} ${
                !isLocalPassAndPlay && p.id === state.myId ? 'me' : ''
              }`}
              style={active ? { borderColor: accent } : undefined}
            >
              <div
                className="opp-name"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <span
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: '50%',
                    background: isP0
                      ? 'radial-gradient(circle at 35% 30%, #fde68a, #ea580c)'
                      : 'radial-gradient(circle at 35% 30%, #e0f2fe, #0284c7)',
                    boxShadow: `0 0 8px ${accent}`,
                    flexShrink: 0,
                  }}
                />
                <span>{p.name}</span>
              </div>
              <div className="opp-meta" style={{ color: isP0 ? '#fde68a' : '#bae6fd' }}>
                {state.subPhase === 'place'
                  ? `配置 ${myWorkers.length}/2`
                  : `最高到達 ${maxH}F / 3F`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* 5x5 立体段差ボード */}
      <div
        className="board-center-wrap"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '4px 0',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 382,
            padding: 10,
            borderRadius: 18,
            background: 'linear-gradient(150deg, #163042 0%, #0d1d29 100%)',
            border: '2px solid rgba(125, 211, 252, 0.3)',
            boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
              gap: 6,
            }}
          >
            {state.heights.map((rowArr, r) =>
              rowArr.map((h, c) => {
                const key = `${r},${c}`;
                const worker = workerByCoord.get(key);
                const styleInfo = HEIGHT_STYLES[Math.min(4, Math.max(0, h))];

                const isPlaceTarget = isMyTurn && state.subPhase === 'place' && !worker;
                const isMovableWorker =
                  isMyTurn &&
                  state.subPhase === 'move' &&
                  worker?.owner === current.side &&
                  (state.validMovesByWorker[worker.id]?.length ?? 0) > 0;
                const isSelectedWorker = worker !== undefined && worker.id === selectedWorkerId;
                const isActiveMover =
                  state.subPhase === 'build' && worker !== undefined && worker.id === state.movedWorkerId;
                const isMoveTarget = validMoveTargetSet.has(key);
                const isBuildTarget = validBuildSet.has(key);
                const isLast = state.lastCoord?.row === r && state.lastCoord?.col === c;

                const interactive =
                  isPlaceTarget || isMovableWorker || isMoveTarget || isBuildTarget;

                // 段数に応じた立体インセット影
                const elevationShadow =
                  h === 0
                    ? 'inset 0 2px 5px rgba(0,0,0,0.38)'
                    : h === 1
                    ? 'inset 0 -3px 0 rgba(100,116,139,0.55), 0 2px 4px rgba(0,0,0,0.3)'
                    : h === 2
                    ? 'inset 0 -5px 0 rgba(100,116,139,0.65), 0 4px 7px rgba(0,0,0,0.38)'
                    : h === 3
                    ? 'inset 0 -6px 0 rgba(217,119,6,0.55), 0 0 12px rgba(251,191,36,0.45)'
                    : 'inset 0 -4px 0 rgba(30,58,138,0.55)';

                const borderColor = isMoveTarget
                  ? '#4ade80'
                  : isBuildTarget
                  ? '#fb923c'
                  : isPlaceTarget
                  ? 'rgba(134, 239, 172, 0.7)'
                  : isSelectedWorker
                  ? '#fde047'
                  : isLast
                  ? 'rgba(254, 240, 138, 0.75)'
                  : styleInfo.border;

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!interactive}
                    onClick={() => handleCellClick(r, c)}
                    aria-label={`行${r + 1} 列${c + 1} 高さ${h}`}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 10,
                      border:
                        isMoveTarget || isBuildTarget || isSelectedWorker
                          ? `2.5px solid ${borderColor}`
                          : `1.5px solid ${borderColor}`,
                      background: styleInfo.bg,
                      boxShadow: isMoveTarget
                        ? `${elevationShadow}, inset 0 0 0 2px rgba(74, 222, 128, 0.45)`
                        : isBuildTarget
                        ? `${elevationShadow}, inset 0 0 0 2px rgba(251, 146, 60, 0.5)`
                        : elevationShadow,
                      position: 'relative',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: interactive ? 'pointer' : 'default',
                      overflow: 'hidden',
                    }}
                  >
                    {/* 段差表現の枠線（2段・3段で内枠を表示） */}
                    {h >= 2 && h <= 3 && (
                      <span
                        style={{
                          position: 'absolute',
                          inset: h === 3 ? 5 : 4,
                          borderRadius: 6,
                          border:
                            h === 3
                              ? '1.5px solid rgba(217, 119, 6, 0.5)'
                              : '1px solid rgba(100, 116, 139, 0.38)',
                          pointerEvents: 'none',
                        }}
                      />
                    )}

                    {/* ドーム (4段目) */}
                    {h >= 4 && <DomeSvg />}

                    {/* ワーカー */}
                    {worker && (
                      <WorkerToken
                        owner={worker.owner}
                        selected={isSelectedWorker}
                        activeMover={isActiveMover}
                      />
                    )}

                    {/* 合法手インジケータ */}
                    {!worker && isMoveTarget && (
                      <span
                        style={{
                          width: h === 3 ? 22 : 16,
                          height: h === 3 ? 22 : 16,
                          borderRadius: '50%',
                          background: h === 3 ? '#facc15' : '#4ade80',
                          border: '2px solid #ffffff',
                          boxShadow: '0 0 10px rgba(74, 222, 128, 0.85)',
                        }}
                      />
                    )}

                    {!worker && isBuildTarget && (
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          background: 'rgba(234, 88, 12, 0.88)',
                          border: '1.5px solid #ffedd5',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                        }}
                      >
                        <Hammer size={12} />
                      </span>
                    )}

                    {!worker && isPlaceTarget && (
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background: 'rgba(134, 239, 172, 0.55)',
                        }}
                      />
                    )}

                    {/* 右上の高さバッジ */}
                    {h > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 2,
                          padding: '1px 4px',
                          borderRadius: 5,
                          background: styleInfo.badgeBg,
                          color: styleInfo.badgeText,
                          fontSize: 9,
                          fontWeight: 900,
                          lineHeight: 1.2,
                          pointerEvents: 'none',
                        }}
                      >
                        {styleInfo.label}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 勝敗カード */}
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
            {state.lastLog}（全{state.moveCount}手）
          </p>
        </div>
      )}

      {/* 下部 ステップガイドバー */}
      {state.phase === 'playing' && (
        <div
          className="sticky-bottom-bar"
          style={{
            background: 'rgba(7, 25, 16, 0.94)',
            borderTop: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '16px 16px 0 0',
            padding: '10px 12px 8px',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 9px',
                  borderRadius: 999,
                  background:
                    state.subPhase === 'build'
                      ? 'rgba(234, 88, 12, 0.25)'
                      : 'rgba(16, 185, 129, 0.24)',
                  border:
                    state.subPhase === 'build'
                      ? '1px solid #fb923c'
                      : '1px solid #4ade80',
                  color: state.subPhase === 'build' ? '#fed7aa' : '#bbf7d0',
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {state.subPhase === 'place' ? (
                  <MapPin size={12} />
                ) : state.subPhase === 'move' ? (
                  <Move size={12} />
                ) : (
                  <Hammer size={12} />
                )}
                {stepLabel}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>
                {!isMyTurn
                  ? `${current.name} の思考中…`
                  : state.subPhase === 'place'
                  ? '空きマスをタップしてワーカーを配置'
                  : state.subPhase === 'move'
                  ? selectedWorkerId
                    ? '緑に光る移動先をタップ（3F到達で勝利）'
                    : '動かす自分のワーカーをタップ'
                  : 'オレンジのマスをタップして1段建築'}
              </span>
            </div>

            {selectedWorkerId && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setRawSelectedWorkerId(null)}
                style={{
                  padding: '4px 8px',
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                <X size={12} />
                解除
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
