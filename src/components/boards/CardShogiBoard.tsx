import React, { useMemo, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import {
  getCardVectorsForSide,
  getMoveCardDef,
  type CardShogiClientState,
  type CardShogiPiece,
} from '../../games/cardShogi';

interface CardShogiBoardProps {
  state: CardShogiClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

const MoveCardMiniGrid: React.FC<{
  cardId: string;
  perspectiveSide: 0 | 1;
  size?: number;
}> = ({ cardId, perspectiveSide, size = 44 }) => {
  const def = getMoveCardDef(cardId);
  const vectors = getCardVectorsForSide(cardId, perspectiveSide);
  const targetSet = new Set(vectors.map(([dr, dc]) => `${2 + dr},${2 + dc}`));
  const accent = def?.accent ?? '#f59e0b';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 54 54"
      style={{ display: 'block', flexShrink: 0 }}
      aria-hidden="true"
    >
      <rect
        x="1"
        y="1"
        width="52"
        height="52"
        rx="6"
        fill="rgba(15, 23, 42, 0.72)"
        stroke="rgba(255, 255, 255, 0.14)"
        strokeWidth="1"
      />
      {Array.from({ length: 5 }).map((_, r) =>
        Array.from({ length: 5 }).map((__, c) => {
          const isCenter = r === 2 && c === 2;
          const isTarget = targetSet.has(`${r},${c}`);
          const x = 4 + c * 9.4;
          const y = 4 + r * 9.4;
          return (
            <rect
              key={`${r}-${c}`}
              x={x}
              y={y}
              width={7.8}
              height={7.8}
              rx={1.8}
              fill={
                isCenter
                  ? '#f8fafc'
                  : isTarget
                  ? accent
                  : 'rgba(148, 163, 184, 0.18)'
              }
            />
          );
        })
      )}
    </svg>
  );
};

const ShogiPieceToken: React.FC<{
  piece: CardShogiPiece;
  selected: boolean;
}> = ({ piece, selected }) => {
  const isP0 = piece.owner === 0;
  const isMaster = piece.role === 'master';
  const fillGrad = isP0
    ? isMaster
      ? 'linear-gradient(160deg, #fef08a 0%, #f59e0b 55%, #b45309 100%)'
      : 'linear-gradient(160deg, #fed7aa 0%, #ea580c 60%, #9a3412 100%)'
    : isMaster
    ? 'linear-gradient(160deg, #e0f2fe 0%, #38bdf8 55%, #0369a1 100%)'
    : 'linear-gradient(160deg, #bae6fd 0%, #0284c7 60%, #075985 100%)';

  return (
    <span
      style={{
        width: isMaster ? '82%' : '72%',
        height: isMaster ? '82%' : '72%',
        background: fillGrad,
        clipPath: isP0
          ? 'polygon(50% 4%, 92% 24%, 84% 96%, 16% 96%, 8% 24%)'
          : 'polygon(16% 4%, 84% 4%, 92% 76%, 50% 96%, 8% 76%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        filter: selected
          ? 'drop-shadow(0 0 8px rgba(253, 224, 71, 0.95))'
          : 'drop-shadow(0 2px 3px rgba(0, 0, 0, 0.52))',
        transform: selected ? 'scale(1.09)' : 'scale(1)',
        transition: 'transform 0.12s ease',
      }}
    >
      <span
        style={{
          fontSize: isMaster ? 18 : 14,
          fontWeight: 900,
          color: isMaster ? '#0f172a' : '#ffffff',
          textShadow: isMaster
            ? '0 1px 0 rgba(255,255,255,0.45)'
            : '0 1px 2px rgba(0,0,0,0.55)',
          lineHeight: 1,
          marginTop: isP0 ? 4 : -4,
        }}
      >
        {isMaster ? '王' : '弟'}
      </span>
    </span>
  );
};

export const CardShogiBoard: React.FC<CardShogiBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [rawCardId, setRawCardId] = useState<string | null>(null);
  const [rawFrom, setRawFrom] = useState<{ row: number; col: number } | null>(null);

  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const winner = state.players.find((p) => p.id === state.winnerId);

  const myPlayer = state.players.find((p) => p.id === state.myId);
  const bottomSide: 0 | 1 = isLocalPassAndPlay
    ? state.turnIndex
    : myPlayer
    ? myPlayer.side
    : 0;
  const topSide: 0 | 1 = bottomSide === 0 ? 1 : 0;

  const bottomPlayer = state.players[bottomSide];
  const topPlayer = state.players[topSide];

  // 選択中カード（手元から外れたら自動クリア）
  const selectedCardId = useMemo(() => {
    if (!isMyTurn || !rawCardId) return null;
    return current.cards.includes(rawCardId) ? rawCardId : null;
  }, [isMyTurn, rawCardId, current.cards]);

  // 選択中駒（無効になったら自動クリア）
  const selectedFrom = useMemo(() => {
    if (!isMyTurn || !rawFrom) return null;
    const p = state.board[rawFrom.row]?.[rawFrom.col];
    if (!p || p.owner !== current.side) return null;
    return rawFrom;
  }, [isMyTurn, rawFrom, state.board, current.side]);

  // 選択中カードで動かせる駒の集合
  const movableSourcesForCard = useMemo(() => {
    const set = new Set<string>();
    if (!isMyTurn) return set;
    for (const m of state.validMoves) {
      if (!selectedCardId || m.cardId === selectedCardId) {
        set.add(`${m.fromRow},${m.fromCol}`);
      }
    }
    return set;
  }, [isMyTurn, state.validMoves, selectedCardId]);

  // 選択中カード＆選択中駒の移動先集合
  const targetMap = useMemo(() => {
    const map = new Map<string, string>(); // "r,c" -> cardId
    if (!isMyTurn || !selectedCardId || !selectedFrom) return map;
    for (const m of state.validMoves) {
      if (
        m.cardId === selectedCardId &&
        m.fromRow === selectedFrom.row &&
        m.fromCol === selectedFrom.col
      ) {
        map.set(`${m.toRow},${m.toCol}`, m.cardId);
      }
    }
    return map;
  }, [isMyTurn, selectedCardId, selectedFrom, state.validMoves]);

  const handleCardSelect = (cardId: string) => {
    if (!isMyTurn || bottomSide !== current.side) return;
    if (selectedCardId === cardId) {
      setRawCardId(null);
      setRawFrom(null);
    } else {
      setRawCardId(cardId);
      // 既に選択中の駒が新カードで動かせないなら駒選択を解除
      if (
        selectedFrom &&
        !state.validMoves.some(
          (m) =>
            m.cardId === cardId &&
            m.fromRow === selectedFrom.row &&
            m.fromCol === selectedFrom.col
        )
      ) {
        setRawFrom(null);
      }
    }
  };

  const handleCellClick = (r: number, c: number) => {
    if (!isMyTurn) return;
    const key = `${r},${c}`;

    // 1. 移動先タップで即移動
    if (selectedCardId && selectedFrom && targetMap.has(key)) {
      const cardId = selectedCardId;
      const from = selectedFrom;
      setRawCardId(null);
      setRawFrom(null);
      onAction({
        type: 'move',
        payload: {
          cardId,
          fromRow: from.row,
          fromCol: from.col,
          toRow: r,
          toCol: c,
        },
      });
      return;
    }

    // 2. 自分の駒をタップ
    const piece = state.board[r][c];
    if (piece && piece.owner === current.side) {
      // カード未選択なら、この駒を動かせる最初のカードを自動選択
      if (!selectedCardId) {
        const matchingMove = state.validMoves.find(
          (m) => m.fromRow === r && m.fromCol === c
        );
        if (matchingMove) {
          setRawCardId(matchingMove.cardId);
          setRawFrom({ row: r, col: c });
        }
        return;
      }

      // 選択中のカードでこの駒が動かせるなら選択（再タップで解除）
      if (
        selectedFrom &&
        selectedFrom.row === r &&
        selectedFrom.col === c
      ) {
        setRawFrom(null);
      } else if (
        state.validMoves.some(
          (m) => m.cardId === selectedCardId && m.fromRow === r && m.fromCol === c
        )
      ) {
        setRawFrom({ row: r, col: c });
      } else {
        // もう一方のカードなら動かせる場合は自動切替
        const altMove = state.validMoves.find(
          (m) => m.fromRow === r && m.fromCol === c
        );
        if (altMove) {
          setRawCardId(altMove.cardId);
          setRawFrom({ row: r, col: c });
        }
      }
      return;
    }

    setRawFrom(null);
  };

  const centerDef = getMoveCardDef(state.centerCard);

  return (
    <div className="board-container">
      {/* プレイヤーバー */}
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && current.id === p.id;
          const isP0 = p.side === 0;
          const accent = isP0 ? '#f59e0b' : '#38bdf8';
          const count = state.board
            .flat()
            .filter((cell) => cell && cell.owner === p.side).length;
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
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    background: accent,
                    boxShadow: `0 0 8px ${accent}`,
                    flexShrink: 0,
                  }}
                />
                <span>{p.name}</span>
              </div>
              <div className="opp-meta" style={{ color: isP0 ? '#fde68a' : '#bae6fd' }}>
                {isP0 ? '下陣' : '上陣'}・残駒 {count}
              </div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* 上部カード帯：相手の手札2枚 + 中央待機カード1枚 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 6,
          width: '100%',
          maxWidth: 388,
          margin: '0 auto',
        }}
      >
        {topPlayer.cards.map((cid) => {
          const def = getMoveCardDef(cid);
          return (
            <div
              key={`top-${cid}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 6px',
                borderRadius: 10,
                background: 'rgba(15, 23, 42, 0.72)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
              }}
            >
              <MoveCardMiniGrid cardId={cid} perspectiveSide={topSide} size={36} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>
                  {topPlayer.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 900,
                    color: def?.accent ?? '#f8fafc',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {def?.name ?? cid}
                </div>
              </div>
            </div>
          );
        })}

        {/* 中央待機カード */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 6px',
            borderRadius: 10,
            background: 'rgba(245, 158, 11, 0.14)',
            border: '1px dashed rgba(251, 191, 36, 0.6)',
          }}
        >
          <MoveCardMiniGrid
            cardId={state.centerCard}
            perspectiveSide={state.turnIndex}
            size={36}
          />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 9,
                color: '#fde68a',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}
            >
              <RefreshCw size={9} />
              待機
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: centerDef?.accent ?? '#fde68a',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {centerDef?.name ?? state.centerCard}
            </div>
          </div>
        </div>
      </div>

      {/* 5x5 和モダン将棋盤 */}
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
            maxWidth: 348,
            padding: 9,
            borderRadius: 16,
            background: 'linear-gradient(145deg, #5a381d 0%, #341e0d 100%)',
            border: '2px solid rgba(226, 182, 122, 0.42)',
            boxShadow: '0 12px 26px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
              gap: 4,
            }}
          >
            {state.board.map((rowArr, r) =>
              rowArr.map((piece, c) => {
                const key = `${r},${c}`;
                const isTempleP1 = r === 0 && c === 2;
                const isTempleP0 = r === 4 && c === 2;
                const isSelected = selectedFrom?.row === r && selectedFrom?.col === c;
                const isTarget = targetMap.has(key);
                const isMovable = movableSourcesForCard.has(key);
                const isLastFrom =
                  state.lastMove?.kind === 'move' &&
                  state.lastMove.fromRow === r &&
                  state.lastMove.fromCol === c;
                const isLastTo =
                  state.lastMove?.kind === 'move' &&
                  state.lastMove.toRow === r &&
                  state.lastMove.toCol === c;

                const interactive = isMyTurn && (isTarget || isMovable || isSelected);

                const bg = isSelected
                  ? 'linear-gradient(145deg, #854d0e, #543008)'
                  : isTarget
                  ? piece
                    ? 'linear-gradient(145deg, #7f1d1d, #450a0a)'
                    : 'linear-gradient(145deg, #2d5a27, #1a3817)'
                  : isTempleP0
                  ? 'linear-gradient(145deg, #d7b27c, #b7894e)'
                  : isTempleP1
                  ? 'linear-gradient(145deg, #c2b69d, #988e79)'
                  : (r + c) % 2 === 0
                  ? '#dfc092'
                  : '#cfa975';

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!interactive}
                    onClick={() => handleCellClick(r, c)}
                    aria-label={`行${r + 1} 列${c + 1}`}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 7,
                      border: isSelected
                        ? '2.5px solid #fde047'
                        : isTarget
                        ? `2.5px solid ${piece ? '#f87171' : '#86efac'}`
                        : isLastTo
                        ? '2px solid rgba(254, 240, 138, 0.85)'
                        : isLastFrom
                        ? '1.5px dashed rgba(255, 255, 255, 0.55)'
                        : isMovable && selectedCardId
                        ? '2px solid rgba(254, 240, 138, 0.65)'
                        : '1px solid rgba(58, 34, 15, 0.45)',
                      background: bg,
                      position: 'relative',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: interactive ? 'pointer' : 'default',
                    }}
                  >
                    {/* 王座マーク */}
                    {(isTempleP0 || isTempleP1) && !piece && (
                      <span
                        style={{
                          position: 'absolute',
                          inset: 5,
                          borderRadius: 4,
                          border: `1.5px dashed ${
                            isTempleP0 ? 'rgba(180, 83, 9, 0.55)' : 'rgba(3, 105, 161, 0.55)'
                          }`,
                          pointerEvents: 'none',
                        }}
                      />
                    )}
                    {(isTempleP0 || isTempleP1) && !piece && !isTarget && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 900,
                          color: isTempleP0
                            ? 'rgba(146, 64, 14, 0.55)'
                            : 'rgba(12, 74, 110, 0.55)',
                          pointerEvents: 'none',
                        }}
                      >
                        座
                      </span>
                    )}

                    {/* 駒 */}
                    {piece && <ShogiPieceToken piece={piece} selected={isSelected} />}

                    {/* 移動先ドット */}
                    {!piece && isTarget && (
                      <span
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: '#86efac',
                          boxShadow: '0 0 8px rgba(134, 239, 172, 0.85)',
                        }}
                      />
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
            {state.winReason === 'temple'
              ? '相手の王座へ王を進めました'
              : '相手の王を討ち取りました'}
            （全{state.moveCount}手）
          </p>
        </div>
      )}

      {/* 下部 手元カードパレット */}
      {state.phase === 'playing' && (
        <div
          className="sticky-bottom-bar"
          style={{
            background: 'rgba(7, 25, 16, 0.94)',
            borderTop: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: '16px 16px 0 0',
            padding: '10px 10px 8px',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
              minHeight: 20,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: '#cbd5e1' }}>
              {!isMyTurn
                ? `${current.name} の思考中…`
                : state.canPass
                ? '合法手がありません。中央と交換するカードを選んでパス'
                : !selectedCardId
                ? '使う移動カードをタップ（または自駒を直接タップ）'
                : !selectedFrom
                ? '動かす自分の駒をタップ'
                : '光っている移動先マスをタップ'}
            </span>
            {(selectedCardId || selectedFrom) && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => {
                  setRawCardId(null);
                  setRawFrom(null);
                }}
                style={{
                  padding: '3px 8px',
                  fontSize: 11,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <X size={12} />
                解除
              </button>
            )}
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
            }}
          >
            {bottomPlayer.cards.map((cid) => {
              const def = getMoveCardDef(cid);
              const isSelected = selectedCardId === cid;
              const disabled = !isMyTurn || bottomSide !== current.side;
              return (
                <button
                  key={`my-${cid}`}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleCardSelect(cid)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '8px 10px',
                    borderRadius: 12,
                    border: isSelected
                      ? '2px solid #fde047'
                      : '1.5px solid rgba(255, 255, 255, 0.16)',
                    background: isSelected
                      ? 'rgba(245, 158, 11, 0.24)'
                      : 'rgba(15, 23, 42, 0.72)',
                    color: '#f8fafc',
                    cursor: disabled ? 'default' : 'pointer',
                    opacity: disabled ? 0.6 : 1,
                    textAlign: 'left',
                  }}
                >
                  <MoveCardMiniGrid cardId={cid} perspectiveSide={bottomSide} size={46} />
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 900,
                        color: def?.accent ?? '#f8fafc',
                        lineHeight: 1.2,
                      }}
                    >
                      {def?.name ?? cid}
                    </div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                      {isSelected ? '選択中' : 'タップで選択'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {state.canPass && isMyTurn && (
            <button
              type="button"
              className="primary-btn"
              disabled={!selectedCardId}
              onClick={() => {
                if (selectedCardId) {
                  const cid = selectedCardId;
                  setRawCardId(null);
                  setRawFrom(null);
                  onAction({ type: 'pass', payload: { cardId: cid } });
                }
              }}
              style={{ width: '100%', marginTop: 8 }}
            >
              選択カードでパス（中央と交換）
            </button>
          )}
        </div>
      )}
    </div>
  );
};
