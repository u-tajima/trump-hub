import React, { useMemo, useState } from 'react';
import { Anchor, Check, Crosshair, Flame, RotateCw, Shield, Shuffle } from 'lucide-react';
import {
  type BattleshipClientState,
  type BattleshipShip,
  getShipCells,
} from '../../games/battleship';

interface BattleshipBoardProps {
  state: BattleshipClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

export const BattleshipBoard: React.FC<BattleshipBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const n = state.rules.boardSize;
  const current = state.players[state.turnIndex];
  const isMyTurn =
    state.phase === 'playing' &&
    state.subPhase === 'battle' &&
    current.id === state.myId;
  const winner = state.players.find((p) => p.id === state.winnerId);

  const myShipCellMap = useMemo(() => {
    const map = new Map<string, BattleshipShip>();
    for (const s of state.myShips) {
      for (const c of getShipCells(s)) {
        map.set(`${c.row},${c.col}`, s);
      }
    }
    return map;
  }, [state.myShips]);

  const oppRevealedMap = useMemo(() => {
    const map = new Map<string, BattleshipShip>();
    for (const s of state.opponentRevealedShips) {
      for (const c of getShipCells(s)) {
        map.set(`${c.row},${c.col}`, s);
      }
    }
    return map;
  }, [state.opponentRevealedShips]);

  const selectedShip = state.myShips.find((s) => s.id === selectedShipId) ?? null;

  const handleSetupCellClick = (row: number, col: number) => {
    if (state.mySetupConfirmed) return;
    const hitShip = myShipCellMap.get(`${row},${col}`);
    if (hitShip) {
      if (selectedShipId === hitShip.id) {
        // 同じ艦を再タップで回転を試行
        onAction({
          type: 'placeShip',
          payload: {
            shipId: hitShip.id,
            row: hitShip.row,
            col: hitShip.col,
            horizontal: !hitShip.horizontal,
          },
        });
      } else {
        setSelectedShipId(hitShip.id);
      }
      return;
    }

    if (selectedShip) {
      onAction({
        type: 'placeShip',
        payload: {
          shipId: selectedShip.id,
          row,
          col,
          horizontal: selectedShip.horizontal,
        },
      });
    }
  };

  const handleRotateSelected = () => {
    if (!selectedShip || state.mySetupConfirmed) return;
    onAction({
      type: 'placeShip',
      payload: {
        shipId: selectedShip.id,
        row: selectedShip.row,
        col: selectedShip.col,
        horizontal: !selectedShip.horizontal,
      },
    });
  };

  const colLabels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));

  return (
    <div className="board-container">
      {/* プレイヤーバー */}
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active =
            state.phase === 'playing' &&
            ((state.subPhase === 'battle' && current.id === p.id) ||
              (state.subPhase === 'setup' && !p.setupConfirmed));
          return (
            <div
              key={p.id}
              className={`opp-pill ${active ? 'active' : ''} ${
                !isLocalPassAndPlay && p.id === state.myId ? 'me' : ''
              }`}
            >
              <div className="opp-name">{p.name}</div>
              <div className="opp-meta">
                {state.subPhase === 'setup'
                  ? p.setupConfirmed
                    ? '準備完了'
                    : '配置中'
                  : `残艦 ${p.remainingShips}/${p.totalShips}`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* ===== SETUP PHASE ===== */}
      {state.subPhase === 'setup' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxWidth: 400,
            width: '100%',
            margin: '0 auto',
          }}
        >
          {state.mySetupConfirmed ? (
            <div className="waiting-banner">
              相手の艦隊配置が完了するのを待っています...
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>
                艦をタップで選択、空きマスで移動、再タップで回転
              </div>
              {selectedShip && (
                <button
                  type="button"
                  className="chip-btn accent"
                  onClick={handleRotateSelected}
                >
                  <RotateCw size={12} /> {selectedShip.name}を回転
                </button>
              )}
            </div>
          )}

          {/* 自陣配置グリッド */}
          <div
            style={{
              background: 'linear-gradient(180deg, #0b253a 0%, #071828 100%)',
              border: '1.5px solid rgba(56, 189, 248, 0.35)',
              borderRadius: 14,
              padding: 8,
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `20px repeat(${n}, minmax(0, 1fr))`,
                gap: 2,
                marginBottom: 2,
              }}
            >
              <div />
              {colLabels.map((lbl) => (
                <div
                  key={lbl}
                  style={{
                    textAlign: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#7dd3fc',
                  }}
                >
                  {lbl}
                </div>
              ))}
            </div>
            {Array.from({ length: n }, (_, r) => (
              <div
                key={r}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `20px repeat(${n}, minmax(0, 1fr))`,
                  gap: 2,
                  marginBottom: 2,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#7dd3fc',
                  }}
                >
                  {r + 1}
                </div>
                {Array.from({ length: n }, (_, c) => {
                  const ship = myShipCellMap.get(`${r},${c}`);
                  const isSelected = ship && ship.id === selectedShipId;
                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      disabled={state.mySetupConfirmed}
                      onClick={() => handleSetupCellClick(r, c)}
                      aria-label={`配置 ${colLabels[c]}${r + 1}`}
                      style={{
                        aspectRatio: '1',
                        borderRadius: 5,
                        border: isSelected
                          ? '2px solid #fbbf24'
                          : ship
                          ? '1.5px solid #38bdf8'
                          : '1px solid rgba(125, 211, 252, 0.16)',
                        background: isSelected
                          ? 'rgba(245, 158, 11, 0.45)'
                          : ship
                          ? 'rgba(56, 189, 248, 0.35)'
                          : 'rgba(15, 45, 70, 0.55)',
                        padding: 0,
                        cursor: state.mySetupConfirmed ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {ship && (
                        <span
                          style={{
                            width: '55%',
                            height: '55%',
                            borderRadius: 3,
                            background: isSelected ? '#fde68a' : '#bae6fd',
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {!state.mySetupConfirmed && (
            <div className="action-bar">
              <button
                type="button"
                className="secondary-btn flex-1"
                onClick={() => {
                  setSelectedShipId(null);
                  onAction({ type: 'autoPlace' });
                }}
              >
                <Shuffle size={15} /> ランダム再配置
              </button>
              <button
                type="button"
                className="primary-btn flex-1"
                onClick={() => {
                  setSelectedShipId(null);
                  onAction({ type: 'confirmSetup' });
                }}
              >
                <Check size={16} /> 配置完了
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== BATTLE PHASE ===== */}
      {state.subPhase === 'battle' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxWidth: 400,
            width: '100%',
            margin: '0 auto',
          }}
        >
          {/* 相手レーダー盤（砲撃エリア） */}
          <div
            style={{
              background: 'linear-gradient(180deg, #092136 0%, #051320 100%)',
              border: isMyTurn
                ? '1.5px solid rgba(245, 158, 11, 0.65)'
                : '1.5px solid rgba(56, 189, 248, 0.3)',
              borderRadius: 14,
              padding: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6,
                padding: '0 4px',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 800,
                  color: isMyTurn ? '#fde68a' : '#7dd3fc',
                }}
              >
                <Crosshair size={14} /> 相手海域（タップで砲撃）
              </span>
              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>
                敵残艦: {state.opponentRemainingLengths.length}隻
              </span>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `18px repeat(${n}, minmax(0, 1fr))`,
                gap: 2,
                marginBottom: 2,
              }}
            >
              <div />
              {colLabels.map((lbl) => (
                <div
                  key={lbl}
                  style={{ textAlign: 'center', fontSize: 9, fontWeight: 700, color: '#7dd3fc' }}
                >
                  {lbl}
                </div>
              ))}
            </div>

            {Array.from({ length: n }, (_, r) => (
              <div
                key={r}
                style={{
                  display: 'grid',
                  gridTemplateColumns: `18px repeat(${n}, minmax(0, 1fr))`,
                  gap: 2,
                  marginBottom: 2,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 700,
                    color: '#7dd3fc',
                  }}
                >
                  {r + 1}
                </div>
                {Array.from({ length: n }, (_, c) => {
                  const shot = state.opponentShotsReceived[r][c];
                  const revealed = oppRevealedMap.get(`${r},${c}`);
                  const isSunk = revealed?.sunk ?? false;
                  const canFire = isMyTurn && shot === null;
                  const isLast =
                    state.lastShot?.targetId !== state.myId &&
                    state.lastShot?.row === r &&
                    state.lastShot?.col === c;

                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      disabled={!canFire}
                      onClick={() => canFire && onAction({ type: 'fire', payload: { row: r, col: c } })}
                      aria-label={`砲撃 ${colLabels[c]}${r + 1}`}
                      style={{
                        aspectRatio: '1',
                        borderRadius: 4,
                        border: isLast
                          ? '2px solid #fbbf24'
                          : isSunk
                          ? '1.5px solid #ef4444'
                          : shot === 'hit'
                          ? '1.5px solid #f97316'
                          : revealed
                          ? '1px solid rgba(148, 163, 184, 0.55)'
                          : '1px solid rgba(56, 189, 248, 0.18)',
                        background: isSunk
                          ? 'rgba(239, 68, 68, 0.42)'
                          : shot === 'hit'
                          ? 'rgba(249, 115, 22, 0.35)'
                          : shot === 'miss'
                          ? 'rgba(148, 163, 184, 0.14)'
                          : revealed
                          ? 'rgba(148, 163, 184, 0.3)'
                          : canFire
                          ? 'rgba(14, 52, 82, 0.72)'
                          : 'rgba(10, 34, 56, 0.55)',
                        padding: 0,
                        cursor: canFire ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                      }}
                    >
                      {shot === 'hit' && <Flame size={n === 10 ? 12 : 14} color={isSunk ? '#fecaca' : '#fed7aa'} />}
                      {shot === 'miss' && (
                        <span
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: 'rgba(148, 163, 184, 0.65)',
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* 自陣ミニ盤面（被弾状況確認） */}
          <div
            style={{
              background: 'rgba(6, 20, 32, 0.72)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 12,
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 800,
                  color: '#cbd5e1',
                }}
              >
                <Shield size={13} color="#38bdf8" /> 自陣の被害状況
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {state.myShips.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: s.sunk ? '#f87171' : '#94a3b8',
                      textDecoration: s.sunk ? 'line-through' : 'none',
                    }}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Anchor size={10} /> {s.name}
                    </span>
                    <span style={{ display: 'inline-flex', gap: 2 }}>
                      {Array.from({ length: s.length }, (_, i) => (
                        <span
                          key={i}
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 2,
                            background: s.sunk ? '#ef4444' : '#38bdf8',
                          }}
                        />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                width: n === 10 ? 136 : 124,
                display: 'grid',
                gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
                gap: 1.5,
                flexShrink: 0,
              }}
            >
              {Array.from({ length: n }, (_, r) =>
                Array.from({ length: n }, (_, c) => {
                  const ship = myShipCellMap.get(`${r},${c}`);
                  const shot = state.myShotsReceived[r][c];
                  return (
                    <div
                      key={`${r}-${c}`}
                      style={{
                        aspectRatio: '1',
                        borderRadius: 2,
                        background:
                          shot === 'hit'
                            ? '#ef4444'
                            : shot === 'miss'
                            ? 'rgba(148, 163, 184, 0.3)'
                            : ship
                            ? '#38bdf8'
                            : 'rgba(15, 45, 70, 0.65)',
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {state.phase === 'finished' && (
        <div className="result-card">
          <h3>
            {isLocalPassAndPlay
              ? `${winner?.name ?? ''} の勝利！`
              : state.winnerId === state.myId
              ? 'あなたの勝利！'
              : '相手の勝利…'}
          </h3>
          <p className="panel-desc">相手海域に敵艦隊の最終配置を公開しました</p>
        </div>
      )}
    </div>
  );
};
