import React, { useEffect, useMemo, useState } from 'react';
import {
  getHasamiLegalDestinations,
  HASAMI_BOARD_SIZE,
  simulateHasamiMove,
  type HasamiShogiClientState,
  type HasamiShogiCoord,
} from '../../games/hasamiShogi';

interface HasamiShogiBoardProps {
  state: HasamiShogiClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

const FILE_LABELS = ['9', '8', '7', '6', '5', '4', '3', '2', '1'];
const RANK_LABELS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

const PIECE_CLIP = 'polygon(50% 4%, 89% 22%, 95% 95%, 5% 95%, 11% 22%)';

export const HasamiShogiBoard: React.FC<HasamiShogiBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [selected, setSelected] = useState<HasamiShogiCoord | null>(null);

  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const myPlayer = state.players.find((p) => p.id === state.myId);
  const isFlipped = !isLocalPassAndPlay && myPlayer?.side === 2;
  const winner = state.players.find((p) => p.id === state.winnerId);

  useEffect(() => {
    setSelected(null);
  }, [state.turnIndex, state.moveCount, state.phase]);

  // 選択中の駒の移動先マップ（捕獲発生数も計算）
  const legalDestMap = useMemo(() => {
    const map = new Map<string, { captureCount: number }>();
    if (!isMyTurn || !selected) return map;
    const dests = getHasamiLegalDestinations(state.board, selected.row, selected.col);
    for (const d of dests) {
      const sim = simulateHasamiMove(
        state.board,
        { fromRow: selected.row, fromCol: selected.col, toRow: d.row, toCol: d.col },
        current.side
      );
      if (sim.valid) {
        map.set(`${d.row},${d.col}`, { captureCount: sim.captures.length });
      }
    }
    return map;
  }, [isMyTurn, selected, state.board, current.side]);

  const capturedHighlightSet = useMemo(() => {
    const set = new Set<string>();
    if (state.lastMove) {
      for (const c of state.lastMove.capturedCells) {
        set.add(`${c.row},${c.col}`);
      }
    }
    return set;
  }, [state.lastMove]);

  const handleCellClick = (row: number, col: number) => {
    if (!isMyTurn) return;
    const key = `${row},${col}`;

    // 移動先ハイライトをタップ -> 移動実行
    if (selected && legalDestMap.has(key)) {
      onAction({
        type: 'move',
        payload: {
          fromRow: selected.row,
          fromCol: selected.col,
          toRow: row,
          toCol: col,
        },
      });
      setSelected(null);
      return;
    }

    // 自分の駒をタップ -> 選択/解除
    if (state.board[row][col] === current.side) {
      if (selected && selected.row === row && selected.col === col) {
        setSelected(null);
      } else {
        setSelected({ row, col });
      }
      return;
    }

    setSelected(null);
  };

  const displayRows = useMemo(
    () =>
      Array.from({ length: HASAMI_BOARD_SIZE }, (_, i) =>
        isFlipped ? HASAMI_BOARD_SIZE - 1 - i : i
      ),
    [isFlipped]
  );
  const displayCols = useMemo(
    () =>
      Array.from({ length: HASAMI_BOARD_SIZE }, (_, i) =>
        isFlipped ? HASAMI_BOARD_SIZE - 1 - i : i
      ),
    [isFlipped]
  );

  return (
    <div className="board-container">
      {/* プレイヤーバー & 獲得枚数ゲージ */}
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && current.id === p.id;
          const isSente = p.side === 1;
          const accent = isSente ? '#f59e0b' : '#f87171';
          const ratio = Math.min(100, (p.captured / state.rules.captureTarget) * 100);
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
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 18,
                    height: 20,
                    clipPath: PIECE_CLIP,
                    background: isSente
                      ? 'linear-gradient(180deg, #fae3b2, #d8ab61)'
                      : 'linear-gradient(180deg, #f7d9a4, #c9974e)',
                    color: isSente ? '#1c1209' : '#991b1b',
                    fontSize: 10,
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  {isSente ? '歩' : 'と'}
                </span>
                <span>{p.name}</span>
              </div>
              <div className="opp-meta" style={{ marginTop: 3 }}>
                獲得 {p.captured} / {state.rules.captureTarget}枚
              </div>
              <div
                style={{
                  marginTop: 4,
                  height: 4,
                  borderRadius: 999,
                  background: 'rgba(255, 255, 255, 0.12)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${ratio}%`,
                    height: '100%',
                    background: accent,
                    transition: 'width 0.25s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* 9×9 将棋盤 */}
      <div
        className="board-center-wrap"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '2px 0',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 400,
            background: 'linear-gradient(155deg, #5c3a1e 0%, #3a2310 100%)',
            borderRadius: 14,
            padding: '6px 6px 8px 8px',
            border: '1.5px solid rgba(246, 220, 166, 0.32)',
            boxShadow: '0 10px 26px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* 上部の筋ラベル */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(9, minmax(0, 1fr))',
              paddingRight: 16,
              marginBottom: 2,
            }}
          >
            {displayCols.map((c) => (
              <div
                key={c}
                style={{
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'rgba(253, 230, 178, 0.78)',
                }}
              >
                {FILE_LABELS[c]}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            {/* 9x9 マス目 */}
            <div
              style={{
                flex: 1,
                aspectRatio: '1 / 1.06',
                display: 'grid',
                gridTemplateColumns: 'repeat(9, minmax(0, 1fr))',
                gridTemplateRows: 'repeat(9, minmax(0, 1fr))',
                background:
                  'linear-gradient(160deg, #ecc984 0%, #deb263 50%, #cfa050 100%)',
                border: '2px solid #4a2d12',
                borderRadius: 4,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {displayRows.map((r) =>
                displayCols.map((c) => {
                  const cell = state.board[r][c];
                  const key = `${r},${c}`;
                  const isSel = selected?.row === r && selected?.col === c;
                  const destInfo = legalDestMap.get(key);
                  const isLastFrom =
                    state.lastMove?.fromRow === r && state.lastMove?.fromCol === c;
                  const isLastTo =
                    state.lastMove?.toRow === r && state.lastMove?.toCol === c;
                  const wasCapturedHere = capturedHighlightSet.has(key);
                  const isClickable =
                    isMyTurn && (cell === current.side || destInfo !== undefined);

                  // 視点に応じた駒の向き（相手側の駒は180度回転）
                  const isPieceOpponentView = isFlipped ? cell === 1 : cell === 2;

                  let bgColor = 'transparent';
                  if (isSel) {
                    bgColor = 'rgba(245, 158, 11, 0.45)';
                  } else if (destInfo && destInfo.captureCount > 0) {
                    bgColor = 'rgba(239, 68, 68, 0.3)';
                  } else if (destInfo) {
                    bgColor = 'rgba(16, 185, 129, 0.28)';
                  } else if (wasCapturedHere) {
                    bgColor = 'rgba(239, 68, 68, 0.25)';
                  } else if (isLastTo) {
                    bgColor = 'rgba(250, 204, 21, 0.32)';
                  } else if (isLastFrom) {
                    bgColor = 'rgba(250, 204, 21, 0.14)';
                  }

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleCellClick(r, c)}
                      aria-label={`${FILE_LABELS[c]}${RANK_LABELS[r]}`}
                      style={{
                        position: 'relative',
                        padding: 0,
                        margin: 0,
                        border: 'none',
                        borderRight: '1px solid rgba(74, 45, 18, 0.55)',
                        borderBottom: '1px solid rgba(74, 45, 18, 0.55)',
                        background: bgColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: isClickable ? 'pointer' : 'default',
                        touchAction: 'manipulation',
                      }}
                    >
                      {/* 移動可能マーカー */}
                      {destInfo && cell === 0 && (
                        <span
                          style={{
                            width: destInfo.captureCount > 0 ? '48%' : '32%',
                            height: destInfo.captureCount > 0 ? '48%' : '32%',
                            borderRadius: '50%',
                            background:
                              destInfo.captureCount > 0
                                ? 'rgba(220, 38, 38, 0.85)'
                                : 'rgba(5, 150, 105, 0.78)',
                            boxShadow:
                              destInfo.captureCount > 0
                                ? '0 0 0 3px rgba(254, 202, 202, 0.65)'
                                : '0 0 0 2px rgba(167, 243, 208, 0.5)',
                          }}
                        />
                      )}

                      {/* 捕獲発生跡リング */}
                      {wasCapturedHere && cell === 0 && !destInfo && (
                        <span
                          style={{
                            width: '54%',
                            height: '54%',
                            borderRadius: '50%',
                            border: '2px dashed rgba(220, 38, 38, 0.72)',
                          }}
                        />
                      )}

                      {/* 五角形将棋駒 */}
                      {cell !== 0 && (
                        <span
                          style={{
                            width: '86%',
                            height: '88%',
                            clipPath: PIECE_CLIP,
                            background:
                              cell === 1
                                ? 'linear-gradient(180deg, #fdf0d2 0%, #e7c079 65%, #cfa152 100%)'
                                : 'linear-gradient(180deg, #fae7be 0%, #deb269 65%, #c28e42 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transform: isPieceOpponentView ? 'rotate(180deg)' : undefined,
                            filter: isSel
                              ? 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.95))'
                              : 'drop-shadow(0 1.5px 1.5px rgba(36, 20, 6, 0.55))',
                            transition: 'transform 0.12s ease',
                          }}
                        >
                          <span
                            style={{
                              fontFamily:
                                '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif',
                              fontSize: 'clamp(14px, 4.2vw, 19px)',
                              fontWeight: 900,
                              lineHeight: 1,
                              marginTop: 2,
                              color: cell === 1 ? '#1a1108' : '#991b1b',
                            }}
                          >
                            {cell === 1 ? '歩' : 'と'}
                          </span>
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* 右側の段ラベル */}
            <div
              style={{
                width: 16,
                display: 'grid',
                gridTemplateRows: 'repeat(9, minmax(0, 1fr))',
                marginLeft: 2,
              }}
            >
              {displayRows.map((r) => (
                <div
                  key={r}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'rgba(253, 230, 178, 0.78)',
                  }}
                >
                  {RANK_LABELS[r]}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 操作ヒント / 結果カード */}
      {state.phase === 'finished' ? (
        <div className="result-card">
          <h3>
            {isLocalPassAndPlay
              ? `${winner?.name ?? ''} の勝利！`
              : state.winnerId === state.myId
              ? 'あなたの勝利！'
              : `${winner?.name ?? '相手'} の勝利…`}
          </h3>
          <p className="panel-desc">
            獲得枚数: {state.players[0].name} {state.players[0].captured}枚 /{' '}
            {state.players[1].name} {state.players[1].captured}枚（全{state.moveCount}手）
          </p>
        </div>
      ) : (
        <div
          style={{
            textAlign: 'center',
            fontSize: 12,
            color: '#94a3b8',
            padding: '2px 8px 6px',
          }}
        >
          {isMyTurn
            ? selected
              ? '緑のマスへ移動（赤は相手の駒を挟んで獲得！）'
              : '自分の駒をタップして縦・横に動かそう（四隅の角挟みも有効）'
            : `${current.name} の手を待っています…`}
        </div>
      )}
    </div>
  );
};
