import React, { useMemo, useRef, useState } from 'react';
import type {
  ChessClientState,
  ChessColor,
  ChessFinishReason,
  ChessMove,
  ChessPieceType,
  ChessPlayerState,
} from '../../games/chess';
import './ChessBoard.css';

export interface ChessBoardProps {
  state: ChessClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const PROMOTION_CHOICES: readonly { type: 'q' | 'r' | 'b' | 'n'; label: string }[] = [
  { type: 'q', label: 'クイーン' },
  { type: 'r', label: 'ルーク' },
  { type: 'b', label: 'ビショップ' },
  { type: 'n', label: 'ナイト' },
];

const MATERIAL_VALUE: Record<ChessPieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

function getFinishReasonLabel(reason: ChessFinishReason): string {
  switch (reason) {
    case 'checkmate':
      return 'チェックメイト';
    case 'stalemate':
      return 'ステイルメイト（引き分け）';
    case 'threefold':
      return '同形三復（引き分け）';
    case 'fiftyMove':
      return '50手ルール（引き分け）';
    case 'insufficientMaterial':
      return '不足戦力（引き分け）';
    case 'resign':
      return '投了';
    default:
      return '';
  }
}

interface ChessPieceSvgProps {
  type: ChessPieceType;
  color: ChessColor;
  className?: string;
}

const ChessPieceSvg: React.FC<ChessPieceSvgProps> = ({ type, color, className }) => {
  const isWhite = color === 'w';
  const fill = isWhite ? '#f8fafc' : '#111827';
  const stroke = isWhite ? '#1e293b' : '#e2e8f0';
  const detail = isWhite ? '#334155' : '#cbd5e1';

  return (
    <svg
      viewBox="0 0 45 45"
      className={className ? `chess-piece-svg ${className}` : 'chess-piece-svg'}
      aria-hidden="true"
    >
      {type === 'k' && (
        <g fill={fill} stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22.5 11.63V6" stroke={stroke} strokeWidth="2" />
          <path d="M20 8h5" stroke={stroke} strokeWidth="2" />
          <path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5" />
          <path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-3.5-7.5-13-10.5-16-4-3 6 5 10 5 10V37z" />
          <path d="M11.5 30c5.5-3 15.5-3 21 0" fill="none" stroke={detail} strokeWidth="1.4" />
          <path d="M11.5 33.5c5.5-3 15.5-3 21 0" fill="none" stroke={detail} strokeWidth="1.4" />
          <path d="M11.5 37c5.5-3 15.5-3 21 0" fill="none" stroke={detail} strokeWidth="1.4" />
        </g>
      )}

      {type === 'q' && (
        <g fill={fill} stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="12" r="2.5" />
          <circle cx="14" cy="9" r="2.5" />
          <circle cx="22.5" cy="8" r="2.5" />
          <circle cx="31" cy="9" r="2.5" />
          <circle cx="39" cy="12" r="2.5" />
          <path d="M9 26c8.5-1.5 21-1.5 27 0l2.5-12.5L31 25l-.3-14.1-5.2 13.6-3-14.5-3 14.5-5.2-13.6L14 25 6.5 13.5 9 26z" />
          <path d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z" />
          <path d="M11.5 30c3.5-1 18.5-1 22 0" fill="none" stroke={detail} strokeWidth="1.4" />
          <path d="M12 33.5c6-1 15-1 21 0" fill="none" stroke={detail} strokeWidth="1.4" />
        </g>
      )}

      {type === 'r' && (
        <g fill={fill} stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 39h27v-3H9v3z" />
          <path d="M12 36v-4h21v4H12z" />
          <path d="M11 14V9h4v2h5V9h5v2h5V9h4v5" />
          <path d="M34 14l-3 3H14l-3-3" />
          <path d="M31 17v12.5H14V17" />
          <path d="M31 29.5l1.5 2.5h-20l1.5-2.5" />
          <path d="M11 14h23" fill="none" stroke={detail} strokeWidth="1.4" />
        </g>
      )}

      {type === 'b' && (
        <g fill={fill} stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2z" />
          <path d="M15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2z" />
          <circle cx="22.5" cy="8" r="2.5" />
          <path d="M17.5 26h10M15 30h15M22.5 15.5v5M20 18h5" fill="none" stroke={detail} strokeWidth="1.5" />
        </g>
      )}

      {type === 'n' && (
        <g fill={fill} stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" />
          <path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.04-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.99-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.99 2.5-3c1 0 1 3 1 3" />
          <circle cx="9.5" cy="25.5" r="0.8" fill={detail} stroke="none" />
          <circle cx="15" cy="15.5" r="1.2" fill={detail} stroke="none" />
          <path d="M24.55 10.4l-.45 1.45.5.15c3.15 1 5.65 2.49 7.9 6.75S35.75 29.06 35.25 39" fill="none" stroke={detail} strokeWidth="1.2" />
        </g>
      )}

      {type === 'p' && (
        <g fill={fill} stroke={stroke} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z" />
        </g>
      )}
    </svg>
  );
};

interface PlayerBarProps {
  player: ChessPlayerState;
  isActive: boolean;
  isMe: boolean;
  materialLead: number;
  canResign: boolean;
  confirmResign: boolean;
  onRequestResign: () => void;
  onConfirmResign: () => void;
  onCancelResign: () => void;
}

const PlayerBar: React.FC<PlayerBarProps> = ({
  player,
  isActive,
  isMe,
  materialLead,
  canResign,
  confirmResign,
  onRequestResign,
  onConfirmResign,
  onCancelResign,
}) => {
  const capturedColor: ChessColor = player.color === 'w' ? 'b' : 'w';

  return (
    <div className={`chess-player-bar ${isActive ? 'is-active' : ''} ${isMe ? 'is-me' : ''}`}>
      <div className="chess-player-main">
        <div className="chess-player-identity">
          <span
            className={`chess-color-badge ${player.color === 'w' ? 'white' : 'black'}`}
            aria-label={player.color === 'w' ? '白' : '黒'}
          />
          <span className="chess-player-name">{player.name}</span>
          {player.isBot && <span className="chess-tag">CPU</span>}
          {isActive && <span className="chess-turn-badge">手番</span>}
        </div>

        <div className="chess-captured-row">
          {player.captured.map((pieceType, idx) => (
            <span key={`${pieceType}-${idx}`} className="chess-captured-icon">
              <ChessPieceSvg type={pieceType} color={capturedColor} />
            </span>
          ))}
          {materialLead > 0 && <span className="chess-material-lead">+{materialLead}</span>}
        </div>
      </div>

      {canResign && (
        <div className="chess-resign-wrap">
          {confirmResign ? (
            <div className="chess-resign-confirm">
              <button
                type="button"
                className="chess-btn chess-btn-danger"
                onClick={onConfirmResign}
              >
                投了する
              </button>
              <button
                type="button"
                className="chess-btn chess-btn-ghost"
                onClick={onCancelResign}
              >
                戻る
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="chess-btn chess-btn-resign"
              onClick={onRequestResign}
              aria-label="投了"
            >
              <svg viewBox="0 0 20 20" className="chess-btn-icon" aria-hidden="true">
                <path
                  d="M4 3v14M4 4h10l-2 3.5L14 11H4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              投了
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export const ChessBoard: React.FC<ChessBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const defaultFlipped = !isLocalPassAndPlay && state.players[1].id === state.myId;
  const [manualFlip, setManualFlip] = useState<boolean | null>(null);
  const flipped = manualFlip ?? defaultFlipped;

  const turnKey = `${state.fullMoveNumber}-${state.turnIndex}-${state.phase}`;
  const [selectedState, setSelectedState] = useState<{
    turnKey: string;
    row: number;
    col: number;
  } | null>(null);
  const [promoState, setPromoState] = useState<{
    turnKey: string;
    fromRow: number;
    fromCol: number;
    toRow: number;
    toCol: number;
  } | null>(null);
  const [resignConfirmKey, setResignConfirmKey] = useState<string | null>(null);
  const lastPointerDownAtRef = useRef(0);
  const dragOriginRef = useRef<{ row: number; col: number } | null>(null);

  const selected = selectedState && selectedState.turnKey === turnKey ? selectedState : null;
  const pendingPromotion = promoState && promoState.turnKey === turnKey ? promoState : null;
  const confirmResign = resignConfirmKey === turnKey;

  const currentPlayer = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && currentPlayer.id === state.myId;
  const myColor = currentPlayer.color;

  const legalMovesByOrigin = useMemo(() => {
    const map = new Map<string, ChessMove[]>();
    for (const m of state.legalMoves) {
      const key = `${m.fromRow}-${m.fromCol}`;
      const list = map.get(key);
      if (list) list.push(m);
      else map.set(key, [m]);
    }
    return map;
  }, [state.legalMoves]);

  const selectedMoves = useMemo(() => {
    if (!selected || !isMyTurn) return [];
    return legalMovesByOrigin.get(`${selected.row}-${selected.col}`) ?? [];
  }, [selected, isMyTurn, legalMovesByOrigin]);

  const targetMoveMap = useMemo(() => {
    const map = new Map<string, ChessMove[]>();
    for (const m of selectedMoves) {
      const key = `${m.toRow}-${m.toCol}`;
      const list = map.get(key);
      if (list) list.push(m);
      else map.set(key, [m]);
    }
    return map;
  }, [selectedMoves]);

  const whiteCapturedScore = useMemo(
    () => state.players[0].captured.reduce((sum, t) => sum + MATERIAL_VALUE[t], 0),
    [state.players]
  );
  const blackCapturedScore = useMemo(
    () => state.players[1].captured.reduce((sum, t) => sum + MATERIAL_VALUE[t], 0),
    [state.players]
  );

  const topPlayer = flipped ? state.players[0] : state.players[1];
  const bottomPlayer = flipped ? state.players[1] : state.players[0];

  const topLead =
    topPlayer.color === 'w'
      ? Math.max(0, whiteCapturedScore - blackCapturedScore)
      : Math.max(0, blackCapturedScore - whiteCapturedScore);
  const bottomLead =
    bottomPlayer.color === 'w'
      ? Math.max(0, whiteCapturedScore - blackCapturedScore)
      : Math.max(0, blackCapturedScore - whiteCapturedScore);

  const handleSquareClick = (row: number, col: number) => {
    if (!isMyTurn || pendingPromotion) return;

    const targetMoves = targetMoveMap.get(`${row}-${col}`);
    if (selected && targetMoves && targetMoves.length > 0) {
      const hasPromotion = targetMoves.some((m) => m.promotion !== undefined);
      if (hasPromotion) {
        setPromoState({
          turnKey,
          fromRow: selected.row,
          fromCol: selected.col,
          toRow: row,
          toCol: col,
        });
        return;
      }

      const chosen = targetMoves[0];
      setSelectedState(null);
      onAction({
        type: 'move',
        payload: {
          fromRow: chosen.fromRow,
          fromCol: chosen.fromCol,
          toRow: chosen.toRow,
          toCol: chosen.toCol,
        },
      });
      return;
    }

    if (selected && selected.row === row && selected.col === col) {
      setSelectedState(null);
      return;
    }

    const piece = state.board[row][col];
    if (piece && piece.color === myColor) {
      setSelectedState({ turnKey, row, col });
      return;
    }

    setSelectedState(null);
  };

  const handleSquarePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
    row: number,
    col: number
  ) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    lastPointerDownAtRef.current = Date.now();
    const targetMoves = targetMoveMap.get(`${row}-${col}`);
    const isTarget = Boolean(selected && targetMoves && targetMoves.length > 0);
    const piece = state.board[row][col];
    const willSelectOwn =
      isMyTurn &&
      !pendingPromotion &&
      !isTarget &&
      piece !== null &&
      piece.color === myColor &&
      !(selected && selected.row === row && selected.col === col);
    dragOriginRef.current = willSelectOwn ? { row, col } : null;
    handleSquareClick(row, col);
  };

  const handleGridPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const origin = dragOriginRef.current;
    dragOriginRef.current = null;
    if (!origin || !isMyTurn || pendingPromotion) return;
    const el = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest<HTMLElement>('[data-chess-square]');
    const raw = el?.dataset.chessSquare;
    if (!raw) return;
    const [rStr, cStr] = raw.split(',');
    const toRow = Number(rStr);
    const toCol = Number(cStr);
    if (Number.isNaN(toRow) || Number.isNaN(toCol)) return;
    if (toRow === origin.row && toCol === origin.col) return;
    const targetMoves = targetMoveMap.get(`${toRow}-${toCol}`);
    if (targetMoves && targetMoves.length > 0) {
      handleSquareClick(toRow, toCol);
    }
  };

  const handleSquareClickFallback = (
    e: React.MouseEvent<HTMLButtonElement>,
    row: number,
    col: number
  ) => {
    if (e.detail !== 0 || Date.now() - lastPointerDownAtRef.current < 500) return;
    handleSquareClick(row, col);
  };

  const handlePromotionSelect = (promo: 'q' | 'r' | 'b' | 'n') => {
    if (!pendingPromotion) return;
    const movePayload = {
      fromRow: pendingPromotion.fromRow,
      fromCol: pendingPromotion.fromCol,
      toRow: pendingPromotion.toRow,
      toCol: pendingPromotion.toCol,
      promotion: promo,
    };
    setPromoState(null);
    setSelectedState(null);
    onAction({ type: 'move', payload: movePayload });
  };

  const handleResignConfirm = () => {
    setResignConfirmKey(null);
    onAction({ type: 'resign' });
  };

  const displayRows = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const displayCols = flipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  const winner = state.players.find((p) => p.id === state.winnerId);
  const canBottomResign =
    state.phase === 'playing' &&
    (isLocalPassAndPlay
      ? currentPlayer.id === bottomPlayer.id && !currentPlayer.isBot
      : bottomPlayer.id === state.myId && !bottomPlayer.isBot);
  const canTopResign =
    state.phase === 'playing' &&
    (isLocalPassAndPlay
      ? currentPlayer.id === topPlayer.id && !currentPlayer.isBot
      : topPlayer.id === state.myId && !topPlayer.isBot);

  return (
    <div className="chess-root">
      <div className="chess-status-row">
        <div className={`chess-log-pill ${state.inCheck && state.phase === 'playing' ? 'is-check' : ''}`}>
          {state.inCheck && state.phase === 'playing' && (
            <svg viewBox="0 0 20 20" className="chess-check-icon" aria-hidden="true">
              <path
                d="M10 2.5L18 17H2L10 2.5z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="M10 8v4M10 14.5h.01" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
          <span className="chess-log-text">{state.lastLog}</span>
        </div>

        <button
          type="button"
          className="chess-flip-btn"
          onClick={() => setManualFlip((prev) => !(prev ?? defaultFlipped))}
          aria-label="盤面を反転"
          title="盤面を反転"
        >
          <svg viewBox="0 0 20 20" className="chess-flip-icon" aria-hidden="true">
            <path
              d="M6 4v12M6 4L3.5 6.5M6 4l2.5 2.5M14 16V4M14 16l-2.5-2.5M14 16l2.5-2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <PlayerBar
        player={topPlayer}
        isActive={state.phase === 'playing' && currentPlayer.id === topPlayer.id}
        isMe={!isLocalPassAndPlay && topPlayer.id === state.myId}
        materialLead={topLead}
        canResign={canTopResign}
        confirmResign={confirmResign && canTopResign}
        onRequestResign={() => setResignConfirmKey(turnKey)}
        onConfirmResign={handleResignConfirm}
        onCancelResign={() => setResignConfirmKey(null)}
      />

      <div className="chess-board-frame">
        <div
          className="chess-board-grid"
          role="grid"
          aria-label="チェス盤"
          onPointerUp={handleGridPointerUp}
          onPointerCancel={() => {
            dragOriginRef.current = null;
          }}
        >
          {displayRows.map((row, visualRowIdx) =>
            displayCols.map((col, visualColIdx) => {
              const piece = state.board[row][col];
              const isLight = (row + col) % 2 === 0;
              const isSelected = selected?.row === row && selected?.col === col;
              const isLastFrom =
                state.lastMove?.fromRow === row && state.lastMove?.fromCol === col;
              const isLastTo = state.lastMove?.toRow === row && state.lastMove?.toCol === col;
              const targetMoves = targetMoveMap.get(`${row}-${col}`);
              const isLegalTarget = Boolean(targetMoves && targetMoves.length > 0);
              const isCaptureTarget =
                isLegalTarget &&
                (piece !== null || Boolean(targetMoves?.some((m) => m.isEnPassant)));
              const isCheckedKing =
                state.inCheck &&
                piece !== null &&
                piece.type === 'k' &&
                piece.color === currentPlayer.color;
              const isOwnSelectable =
                isMyTurn && piece !== null && piece.color === myColor;

              const showRankLabel = visualColIdx === 0;
              const showFileLabel = visualRowIdx === 7;

              const squareClasses = [
                'chess-square',
                isLight ? 'light' : 'dark',
                isSelected ? 'selected' : '',
                isLastFrom || isLastTo ? 'last-move' : '',
                isCheckedKing ? 'in-check' : '',
                isLegalTarget || isOwnSelectable ? 'interactive' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <button
                  key={`${row}-${col}`}
                  type="button"
                  data-chess-square={`${row},${col}`}
                  className={squareClasses}
                  onPointerDown={(e) => handleSquarePointerDown(e, row, col)}
                  onClick={(e) => handleSquareClickFallback(e, row, col)}
                  aria-label={`${FILES[col]}${8 - row}`}
                >
                  {showRankLabel && (
                    <span className={`chess-coord-rank ${isLight ? 'on-light' : 'on-dark'}`}>
                      {8 - row}
                    </span>
                  )}
                  {showFileLabel && (
                    <span className={`chess-coord-file ${isLight ? 'on-light' : 'on-dark'}`}>
                      {FILES[col]}
                    </span>
                  )}

                  {piece && <ChessPieceSvg type={piece.type} color={piece.color} />}

                  {isLegalTarget && !isCaptureTarget && <span className="chess-move-dot" />}
                  {isLegalTarget && isCaptureTarget && <span className="chess-capture-ring" />}
                </button>
              );
            })
          )}
        </div>

        {pendingPromotion && (
          <div className="chess-promo-backdrop" role="dialog" aria-modal="true" aria-label="プロモーション選択">
            <div className="chess-promo-modal">
              <div className="chess-promo-title">昇格する駒を選択</div>
              <div className="chess-promo-grid">
                {PROMOTION_CHOICES.map((choice) => (
                  <button
                    key={choice.type}
                    type="button"
                    className="chess-promo-btn"
                    onClick={() => handlePromotionSelect(choice.type)}
                  >
                    <ChessPieceSvg type={choice.type} color={myColor} className="chess-promo-piece" />
                    <span className="chess-promo-label">{choice.label}</span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="chess-btn chess-btn-ghost chess-promo-cancel"
                onClick={() => setPromoState(null)}
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>

      <PlayerBar
        player={bottomPlayer}
        isActive={state.phase === 'playing' && currentPlayer.id === bottomPlayer.id}
        isMe={!isLocalPassAndPlay && bottomPlayer.id === state.myId}
        materialLead={bottomLead}
        canResign={canBottomResign}
        confirmResign={confirmResign && canBottomResign}
        onRequestResign={() => setResignConfirmKey(turnKey)}
        onConfirmResign={handleResignConfirm}
        onCancelResign={() => setResignConfirmKey(null)}
      />

      {state.phase === 'finished' && (
        <div className="chess-result-card">
          <div className="chess-result-heading">
            {state.winnerId === 'draw'
              ? '引き分け'
              : isLocalPassAndPlay
              ? `${winner?.name ?? ''} の勝利`
              : state.winnerId === state.myId
              ? 'あなたの勝利'
              : `${winner?.name ?? '相手'} の勝利`}
          </div>
          <div className="chess-result-reason">
            決着理由: {getFinishReasonLabel(state.finishReason)}
          </div>
        </div>
      )}
    </div>
  );
};
