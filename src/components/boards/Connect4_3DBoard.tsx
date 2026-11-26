import React, { useMemo } from 'react';
import { ArrowDownToLine, Layers } from 'lucide-react';
import {
  C4_3D_SIZE,
  findLowestEmptyZ,
  type Connect4_3DClientState,
} from '../../games/connect4_3d';

interface Connect4_3DBoardProps {
  state: Connect4_3DClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

const COL_LABELS = ['A', 'B', 'C', 'D'];
const ROW_LABELS = ['1', '2', '3', '4'];
const FLOOR_NAMES = ['1F', '2F', '3F', '4F'];
const FLOOR_SUBS = ['最下層', '2段目', '3段目', '最上層'];

export const Connect4_3DBoard: React.FC<Connect4_3DBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const winner = state.players.find((p) => p.id === state.winnerId);

  const winningSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of state.winningLine) {
      set.add(`${c.z},${c.row},${c.col}`);
    }
    return set;
  }, [state.winningLine]);

  // 各柱 (r, c) の最下空き階層 z (-1 なら満杯)
  const lowestEmptyGrid = useMemo(() => {
    return Array.from({ length: C4_3D_SIZE }, (_, r) =>
      Array.from({ length: C4_3D_SIZE }, (_, c) => findLowestEmptyZ(state.board, r, c))
    );
  }, [state.board]);

  const floorCounts = useMemo(() => {
    return state.board.map((layer) => {
      let n = 0;
      for (const row of layer) {
        for (const cell of row) {
          if (cell !== 0) n++;
        }
      }
      return n;
    });
  }, [state.board]);

  const handleCellClick = (z: number, row: number, col: number) => {
    if (!isMyTurn) return;
    if (state.rules.gravityMode) {
      const targetZ = lowestEmptyGrid[row][col];
      if (targetZ < 0) return;
      onAction({ type: 'place', payload: { z: targetZ, row, col } });
    } else {
      if (state.board[z][row][col] !== 0) return;
      onAction({ type: 'place', payload: { z, row, col } });
    }
  };

  return (
    <div className="board-container">
      {/* プレイヤーバー */}
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && current.id === p.id;
          const isRed = p.disc === 1;
          const accent = isRed ? '#ef4444' : '#facc15';
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
                    background: isRed
                      ? 'radial-gradient(circle at 35% 30%, #fca5a5, #dc2626)'
                      : 'radial-gradient(circle at 35% 30%, #fef08a, #eab308)',
                    boxShadow: `0 0 8px ${accent}`,
                    flexShrink: 0,
                  }}
                />
                <span>{p.name}</span>
              </div>
              <div className="opp-meta">
                {active
                  ? isLocalPassAndPlay
                    ? '手番'
                    : p.id === state.myId
                    ? 'あなたの番'
                    : '相手の番'
                  : '待機'}
              </div>
            </div>
          );
        })}
      </div>

      {/* モード表示 + ログバナー */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginBottom: 2,
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 800,
            padding: '2px 9px',
            borderRadius: 999,
            background: state.rules.gravityMode
              ? 'rgba(16, 185, 129, 0.16)'
              : 'rgba(56, 189, 248, 0.16)',
            border: state.rules.gravityMode
              ? '1px solid rgba(52, 211, 153, 0.45)'
              : '1px solid rgba(56, 189, 248, 0.45)',
            color: state.rules.gravityMode ? '#6ee7b7' : '#7dd3fc',
          }}
        >
          {state.rules.gravityMode ? (
            <>
              <ArrowDownToLine size={12} />
              重力モード（下層から積む）
            </>
          ) : (
            <>
              <Layers size={12} />
              自由配置モード（全階層OK）
            </>
          )}
        </span>
        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>
          {state.moveCount} / 64手
        </span>
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* 2x2 配置の 4階層ボード（1F〜4F） */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 8,
          width: '100%',
          maxWidth: 420,
          margin: '2px auto 4px',
        }}
      >
        {[0, 1, 2, 3].map((z) => {
          const hasLastInFloor = state.lastMove?.z === z;
          const hasWinInFloor = state.winningLine.some((w) => w.z === z);

          return (
            <div
              key={z}
              style={{
                background:
                  'linear-gradient(160deg, rgba(15, 29, 52, 0.94) 0%, rgba(9, 17, 34, 0.96) 100%)',
                border: hasWinInFloor
                  ? '1.5px solid #fde047'
                  : hasLastInFloor
                  ? '1.5px solid rgba(56, 189, 248, 0.65)'
                  : '1px solid rgba(148, 163, 184, 0.24)',
                borderRadius: 12,
                padding: '6px 6px 7px',
                boxShadow: hasWinInFloor
                  ? '0 0 16px rgba(250, 204, 21, 0.35)'
                  : '0 6px 16px rgba(0, 0, 0, 0.38)',
              }}
            >
              {/* 階層ヘッダー */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                  padding: '0 2px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 900,
                      padding: '1px 6px',
                      borderRadius: 6,
                      background: hasWinInFloor
                        ? '#facc15'
                        : 'rgba(59, 130, 246, 0.28)',
                      color: hasWinInFloor ? '#1c1917' : '#bfdbfe',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {FLOOR_NAMES[z]}
                  </span>
                  <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>
                    {FLOOR_SUBS[z]}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>
                  {floorCounts[z]}/16
                </span>
              </div>

              {/* 列ラベル A-D */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '12px repeat(4, minmax(0, 1fr))',
                  gap: 3,
                  marginBottom: 2,
                }}
              >
                <span />
                {COL_LABELS.map((lbl) => (
                  <span
                    key={lbl}
                    style={{
                      textAlign: 'center',
                      fontSize: 9,
                      fontWeight: 800,
                      color: '#64748b',
                    }}
                  >
                    {lbl}
                  </span>
                ))}
              </div>

              {/* 4x4 セルグリッド */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[0, 1, 2, 3].map((r) => (
                  <div
                    key={r}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '12px repeat(4, minmax(0, 1fr))',
                      gap: 3,
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        textAlign: 'center',
                        fontSize: 9,
                        fontWeight: 800,
                        color: '#64748b',
                      }}
                    >
                      {ROW_LABELS[r]}
                    </span>

                    {[0, 1, 2, 3].map((c) => {
                      const cell = state.board[z][r][c];
                      const key = `${z},${r},${c}`;
                      const isWin = winningSet.has(key);
                      const isLast =
                        state.lastMove?.z === z &&
                        state.lastMove?.row === r &&
                        state.lastMove?.col === c;
                      const lowestZ = lowestEmptyGrid[r][c];
                      const isNextGravitySlot =
                        isMyTurn && state.rules.gravityMode && lowestZ === z;
                      const canClick =
                        isMyTurn &&
                        (state.rules.gravityMode ? lowestZ >= 0 : cell === 0);

                      const discBg =
                        cell === 1
                          ? 'radial-gradient(circle at 32% 28%, #fecaca 0%, #ef4444 48%, #991b1b 100%)'
                          : cell === 2
                          ? 'radial-gradient(circle at 32% 28%, #fef9c3 0%, #facc15 48%, #a16207 100%)'
                          : isNextGravitySlot
                          ? 'rgba(16, 185, 129, 0.24)'
                          : 'rgba(15, 23, 42, 0.78)';

                      return (
                        <button
                          key={c}
                          type="button"
                          disabled={!canClick}
                          onClick={() => handleCellClick(z, r, c)}
                          aria-label={`${FLOOR_NAMES[z]} ${COL_LABELS[c]}${ROW_LABELS[r]}`}
                          style={{
                            position: 'relative',
                            width: '100%',
                            aspectRatio: '1 / 1',
                            padding: 3,
                            borderRadius: 8,
                            border: isWin
                              ? '2px solid #fde047'
                              : isNextGravitySlot
                              ? '1.5px solid rgba(52, 211, 153, 0.85)'
                              : isLast
                              ? '1.5px solid rgba(255, 255, 255, 0.85)'
                              : '1px solid rgba(148, 163, 184, 0.18)',
                            background: isWin
                              ? 'rgba(250, 204, 21, 0.24)'
                              : isNextGravitySlot
                              ? 'rgba(16, 185, 129, 0.12)'
                              : 'rgba(30, 41, 59, 0.62)',
                            boxShadow: isWin
                              ? '0 0 12px rgba(250, 204, 21, 0.75)'
                              : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: canClick ? 'pointer' : 'default',
                            touchAction: 'manipulation',
                          }}
                        >
                          <span
                            style={{
                              width: '100%',
                              height: '100%',
                              borderRadius: '50%',
                              background: discBg,
                              boxShadow:
                                cell !== 0
                                  ? 'inset 0 -2px 4px rgba(0,0,0,0.4), 0 1px 3px rgba(0,0,0,0.5)'
                                  : 'inset 0 2px 4px rgba(0,0,0,0.55)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {isWin && (
                              <span
                                style={{
                                  width: '36%',
                                  height: '36%',
                                  borderRadius: '50%',
                                  background: '#ffffff',
                                  boxShadow: '0 0 6px #fef08a',
                                }}
                              />
                            )}
                            {!isWin && isLast && cell !== 0 && (
                              <span
                                style={{
                                  width: '28%',
                                  height: '28%',
                                  borderRadius: '50%',
                                  background: '#ffffff',
                                  opacity: 0.9,
                                }}
                              />
                            )}
                            {cell === 0 && isNextGravitySlot && (
                              <span
                                style={{
                                  width: '26%',
                                  height: '26%',
                                  borderRadius: '50%',
                                  background: '#34d399',
                                  opacity: 0.85,
                                }}
                              />
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 結果カード or 操作ガイド */}
      {state.phase === 'finished' ? (
        <div className="result-card">
          <h3>
            {state.winnerId === 'draw'
              ? '引き分け！'
              : isLocalPassAndPlay
              ? `${winner?.name ?? ''} の勝利！`
              : state.winnerId === state.myId
              ? 'あなたの勝利！'
              : `${winner?.name ?? '相手'} の勝利…`}
          </h3>
          {state.winnerId !== 'draw' && (
            <p className="panel-desc">
              {winner?.disc === 1 ? '赤' : '黄'}が立体4連を完成させました（全{state.moveCount}手）
            </p>
          )}
        </div>
      ) : (
        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: '#94a3b8',
            padding: '2px 8px 6px',
          }}
        >
          {isMyTurn
            ? state.rules.gravityMode
              ? '緑の枠が次に置ける高さ。どの階をタップしても同じ柱の最下空き層に落ちます'
              : '1F〜4Fの好きな空きマスをタップして立体4連（全76ライン）を狙おう'
            : `${current.name} の手を待っています…`}
        </div>
      )}
    </div>
  );
};
