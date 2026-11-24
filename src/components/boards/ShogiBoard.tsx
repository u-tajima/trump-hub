import React, { useMemo, useState, useEffect } from 'react';
import {
  HAND_PIECE_ORDER,
  type ShogiClientState,
  type ShogiHandPieceType,
  type ShogiMove,
  type ShogiPiece,
  type ShogiPieceType,
  type ShogiPlayerState,
} from '../../games/shogi';
import './ShogiBoard.css';

export interface ShogiBoardProps {
  state: ShogiClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

type Selection =
  | { kind: 'board'; row: number; col: number }
  | { kind: 'hand'; pieceType: ShogiHandPieceType }
  | null;

interface PendingPromotion {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  pieceType: ShogiPieceType;
}

const UNPROMOTED_KANJI: Record<ShogiPieceType, string> = {
  K: '玉',
  R: '飛',
  B: '角',
  G: '金',
  S: '銀',
  N: '桂',
  L: '香',
  P: '歩',
};

const PROMOTED_KANJI: Partial<Record<ShogiPieceType, string>> = {
  R: '龍',
  B: '馬',
  S: '全',
  N: '圭',
  L: '杏',
  P: 'と',
};

const RANK_KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

function getPieceLabel(piece: ShogiPiece): string {
  if (piece.type === 'K') {
    return piece.owner === 1 ? '玉' : '王';
  }
  if (piece.promoted) {
    return PROMOTED_KANJI[piece.type] ?? UNPROMOTED_KANJI[piece.type];
  }
  return UNPROMOTED_KANJI[piece.type];
}

function getFinishReasonLabel(reason: ShogiClientState['finishReason']): string {
  switch (reason) {
    case 'checkmate':
      return '詰み';
    case 'sennichite':
      return '千日手（引き分け）';
    case 'perpetualCheck':
      return '連続王手の千日手（反則負け）';
    case 'resign':
      return '投了';
    default:
      return '';
  }
}

export const ShogiBoard: React.FC<ShogiBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [selection, setSelection] = useState<Selection>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);

  const currentPlayer = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && currentPlayer.id === state.myId;
  const myPlayer = state.players.find((p) => p.id === state.myId);
  const isFlipped = !isLocalPassAndPlay && myPlayer?.side === 2;

  const topPlayer: ShogiPlayerState = isFlipped ? state.players[0] : state.players[1];
  const bottomPlayer: ShogiPlayerState = isFlipped ? state.players[1] : state.players[0];

  // Reset transient UI state whenever turn or board updates
  useEffect(() => {
    setSelection(null);
    setPendingPromotion(null);
    setConfirmResign(false);
  }, [state.turnIndex, state.positionHistory.length, state.phase]);

  // Compute legal destination map for current selection
  const targetMovesByCoord = useMemo(() => {
    const map = new Map<string, ShogiMove[]>();
    if (!isMyTurn || !selection) return map;

    for (const m of state.legalMoves) {
      if (selection.kind === 'board' && m.kind === 'move') {
        if (m.fromRow === selection.row && m.fromCol === selection.col) {
          const key = `${m.toRow},${m.toCol}`;
          const list = map.get(key) ?? [];
          list.push(m);
          map.set(key, list);
        }
      } else if (selection.kind === 'hand' && m.kind === 'drop') {
        if (m.pieceType === selection.pieceType) {
          const key = `${m.toRow},${m.toCol}`;
          const list = map.get(key) ?? [];
          list.push(m);
          map.set(key, list);
        }
      }
    }
    return map;
  }, [isMyTurn, selection, state.legalMoves]);

  const handleCellClick = (row: number, col: number) => {
    if (!isMyTurn) return;

    const coordKey = `${row},${col}`;
    const matchingMoves = targetMovesByCoord.get(coordKey);

    if (matchingMoves && matchingMoves.length > 0) {
      const first = matchingMoves[0];
      if (first.kind === 'drop') {
        onAction({
          type: 'drop',
          payload: {
            pieceType: first.pieceType,
            toRow: first.toRow,
            toCol: first.toCol,
          },
        });
        setSelection(null);
        return;
      }

      // Board move: check if both promote and non-promote are legal
      const hasPromote = matchingMoves.some((m) => m.kind === 'move' && m.promote);
      const hasUnpromote = matchingMoves.some((m) => m.kind === 'move' && !m.promote);
      if (hasPromote && hasUnpromote) {
        const piece = state.board[first.fromRow][first.fromCol];
        setPendingPromotion({
          fromRow: first.fromRow,
          fromCol: first.fromCol,
          toRow: first.toRow,
          toCol: first.toCol,
          pieceType: piece?.type ?? 'P',
        });
        return;
      }

      onAction({
        type: 'move',
        payload: {
          fromRow: first.fromRow,
          fromCol: first.fromCol,
          toRow: first.toRow,
          toCol: first.toCol,
          promote: first.promote,
        },
      });
      setSelection(null);
      return;
    }

    // Otherwise check if tapping own piece to select/deselect
    const cell = state.board[row][col];
    if (cell && cell.owner === currentPlayer.side) {
      if (selection?.kind === 'board' && selection.row === row && selection.col === col) {
        setSelection(null);
      } else {
        setSelection({ kind: 'board', row, col });
      }
      return;
    }

    setSelection(null);
  };

  const handleHandClick = (player: ShogiPlayerState, pieceType: ShogiHandPieceType) => {
    if (!isMyTurn) return;
    if (player.id !== currentPlayer.id) return;
    if (player.hand[pieceType] <= 0) return;

    if (selection?.kind === 'hand' && selection.pieceType === pieceType) {
      setSelection(null);
    } else {
      setSelection({ kind: 'hand', pieceType });
    }
  };

  const handlePromotionChoice = (promote: boolean) => {
    if (!pendingPromotion) return;
    onAction({
      type: 'move',
      payload: {
        fromRow: pendingPromotion.fromRow,
        fromCol: pendingPromotion.fromCol,
        toRow: pendingPromotion.toRow,
        toCol: pendingPromotion.toCol,
        promote,
      },
    });
    setPendingPromotion(null);
    setSelection(null);
  };

  const handleResign = () => {
    setConfirmResign(false);
    onAction({ type: 'resign' });
  };

  const renderHandTray = (player: ShogiPlayerState, position: 'top' | 'bottom') => {
    const isActiveTurn = state.phase === 'playing' && currentPlayer.id === player.id;
    const isCheckedPlayer = isActiveTurn && state.inCheck;
    const canSelectHand = isMyTurn && player.id === currentPlayer.id;
    const sideLabel = player.side === 1 ? '先手' : '後手';

    return (
      <div
        className={`shogi-player-tray ${position} ${isActiveTurn ? 'active-turn' : ''} ${
          isCheckedPlayer ? 'in-check' : ''
        }`}
      >
        <div className="shogi-player-header">
          <div className="shogi-player-ident">
            <span className={`shogi-side-tag side-${player.side}`}>{sideLabel}</span>
            <span className="shogi-player-name">{player.name}</span>
            {isCheckedPlayer && <span className="shogi-check-badge">王手</span>}
          </div>
          {isActiveTurn && <span className="shogi-turn-dot" aria-label="手番" />}
        </div>

        <div className="shogi-hand-list" role="group" aria-label={`${player.name}の持ち駒`}>
          {HAND_PIECE_ORDER.map((pt) => {
            const count = player.hand[pt];
            const isSelected =
              canSelectHand && selection?.kind === 'hand' && selection.pieceType === pt;
            return (
              <button
                key={pt}
                type="button"
                disabled={!canSelectHand || count === 0}
                onClick={() => handleHandClick(player, pt)}
                className={`shogi-hand-btn ${count === 0 ? 'empty' : ''} ${
                  isSelected ? 'selected' : ''
                }`}
                aria-label={`${UNPROMOTED_KANJI[pt]} ${count}枚`}
              >
                <span className="shogi-hand-koma">{UNPROMOTED_KANJI[pt]}</span>
                {count > 0 && <span className="shogi-hand-count">{count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const displayIndices = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const rowOrder = isFlipped ? [...displayIndices].reverse() : displayIndices;
  const colOrder = isFlipped ? [...displayIndices].reverse() : displayIndices;

  const winner = state.players.find((p) => p.id === state.winnerId);
  const canResign = state.phase === 'playing' && Boolean(myPlayer);

  return (
    <div className="shogi-root">
      {renderHandTray(topPlayer, 'top')}

      <div className="shogi-status-row">
        <div className="shogi-log-text">{state.lastLog}</div>
        {canResign && (
          <button
            type="button"
            className="shogi-resign-btn"
            onClick={() => setConfirmResign(true)}
          >
            投了
          </button>
        )}
      </div>

      <div className="shogi-board-frame">
        {/* File labels (9..1) */}
        <div className="shogi-file-labels" aria-hidden="true">
          {colOrder.map((c) => (
            <span key={c}>{9 - c}</span>
          ))}
        </div>

        <div className="shogi-board-middle">
          <div className="shogi-grid-wrap">
            <div className="shogi-grid" role="grid" aria-label="将棋盤">
              {rowOrder.map((r) =>
                colOrder.map((c) => {
                  const piece = state.board[r][c];
                  const isSelected =
                    selection?.kind === 'board' && selection.row === r && selection.col === c;
                  const isTarget = targetMovesByCoord.has(`${r},${c}`);
                  const isLastTo =
                    state.lastMove?.toRow === r && state.lastMove?.toCol === c;
                  const isLastFrom =
                    state.lastMove?.fromRow === r && state.lastMove?.fromCol === c;
                  const isCheckedKing =
                    state.phase === 'playing' &&
                    state.inCheck &&
                    piece?.type === 'K' &&
                    piece.owner === currentPlayer.side;
                  const isOppPiece = piece !== null && piece.owner === topPlayer.side;

                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      onClick={() => handleCellClick(r, c)}
                      className={`shogi-cell ${isSelected ? 'selected' : ''} ${
                        isTarget ? 'legal-target' : ''
                      } ${isLastTo ? 'last-to' : ''} ${isLastFrom ? 'last-from' : ''} ${
                        isCheckedKing ? 'checked-king' : ''
                      }`}
                      aria-label={`${9 - c}${RANK_KANJI[r]}${
                        piece ? ` ${getPieceLabel(piece)}` : ''
                      }`}
                    >
                      {piece && (
                        <span
                          className={`shogi-piece-wrap ${isOppPiece ? 'rotated' : ''}`}
                        >
                          <span
                            className={`shogi-piece ${piece.promoted ? 'promoted' : ''} ${
                              piece.type === 'K' ? 'king' : ''
                            }`}
                          >
                            {getPieceLabel(piece)}
                          </span>
                        </span>
                      )}
                      {isTarget && !piece && <span className="shogi-move-dot" />}
                      {isTarget && piece && <span className="shogi-capture-ring" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* 4 Star points (星) */}
            <span className="shogi-star" style={{ top: '33.333%', left: '33.333%' }} />
            <span className="shogi-star" style={{ top: '33.333%', left: '66.667%' }} />
            <span className="shogi-star" style={{ top: '66.667%', left: '33.333%' }} />
            <span className="shogi-star" style={{ top: '66.667%', left: '66.667%' }} />
          </div>

          {/* Rank labels (一..九) */}
          <div className="shogi-rank-labels" aria-hidden="true">
            {rowOrder.map((r) => (
              <span key={r}>{RANK_KANJI[r]}</span>
            ))}
          </div>
        </div>
      </div>

      {renderHandTray(bottomPlayer, 'bottom')}

      {/* Finished Result Banner */}
      {state.phase === 'finished' && (
        <div className="shogi-result-card">
          <h3 className="shogi-result-title">
            {state.winnerId === 'draw'
              ? '引き分け'
              : isLocalPassAndPlay
              ? `${winner?.name ?? ''} の勝利`
              : state.winnerId === state.myId
              ? 'あなたの勝利'
              : `${winner?.name ?? '相手'} の勝利`}
          </h3>
          <p className="shogi-result-reason">{getFinishReasonLabel(state.finishReason)}</p>
        </div>
      )}

      {/* Promotion Choice Modal */}
      {pendingPromotion && (
        <div
          className="shogi-modal-backdrop"
          onClick={() => setPendingPromotion(null)}
          role="dialog"
          aria-modal="true"
          aria-label="成り選択"
        >
          <div className="shogi-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="shogi-modal-title">成りますか？</div>
            <div className="shogi-promo-options">
              <button
                type="button"
                className="shogi-promo-btn promote"
                onClick={() => handlePromotionChoice(true)}
              >
                <span className="shogi-promo-koma promoted">
                  {PROMOTED_KANJI[pendingPromotion.pieceType] ??
                    UNPROMOTED_KANJI[pendingPromotion.pieceType]}
                </span>
                <span className="shogi-promo-label">成る</span>
              </button>
              <button
                type="button"
                className="shogi-promo-btn unpromote"
                onClick={() => handlePromotionChoice(false)}
              >
                <span className="shogi-promo-koma">
                  {UNPROMOTED_KANJI[pendingPromotion.pieceType]}
                </span>
                <span className="shogi-promo-label">成らない</span>
              </button>
            </div>
            <button
              type="button"
              className="shogi-modal-cancel"
              onClick={() => setPendingPromotion(null)}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Resign Confirmation Modal */}
      {confirmResign && (
        <div
          className="shogi-modal-backdrop"
          onClick={() => setConfirmResign(false)}
          role="dialog"
          aria-modal="true"
          aria-label="投了確認"
        >
          <div className="shogi-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="shogi-modal-title">投了しますか？</div>
            <div className="shogi-confirm-actions">
              <button
                type="button"
                className="shogi-confirm-btn danger"
                onClick={handleResign}
              >
                投了する
              </button>
              <button
                type="button"
                className="shogi-confirm-btn secondary"
                onClick={() => setConfirmResign(false)}
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
