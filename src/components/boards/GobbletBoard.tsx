import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type {
  GobbletClientState,
  GobbletCoord,
  GobbletPiece,
  GobbletSize,
} from '../../games/gobblet';

interface GobbletBoardProps {
  state: GobbletClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

type Selection =
  | { kind: 'reserve'; size: GobbletSize }
  | { kind: 'board'; coord: GobbletCoord; size: GobbletSize }
  | null;

const SIZE_NAMES: Record<GobbletSize, string> = {
  1: '小',
  2: '中',
  3: '大',
};

const CupPiece: React.FC<{
  owner: 0 | 1;
  size: GobbletSize;
  selected?: boolean;
  winning?: boolean;
  compact?: boolean;
}> = ({ owner, size, selected = false, winning = false, compact = false }) => {
  const ratio = size === 3 ? 84 : size === 2 ? 64 : 44;
  const isAmber = owner === 0;
  const outerBg = isAmber
    ? 'radial-gradient(circle at 32% 26%, #fde68a 0%, #f59e0b 48%, #c2410c 100%)'
    : 'radial-gradient(circle at 32% 26%, #e0f2fe 0%, #38bdf8 48%, #0369a1 100%)';
  const innerRim = isAmber ? 'rgba(124, 45, 18, 0.52)' : 'rgba(7, 89, 133, 0.55)';
  const ringHighlight = isAmber ? 'rgba(254, 243, 199, 0.72)' : 'rgba(224, 242, 254, 0.75)';
  const borderColor = winning
    ? '#fde047'
    : selected
    ? '#ffffff'
    : isAmber
    ? '#9a3412'
    : '#075985';

  return (
    <span
      style={{
        width: compact ? `${Math.round(ratio * 0.58)}px` : `${ratio}%`,
        height: compact ? `${Math.round(ratio * 0.58)}px` : `${ratio}%`,
        borderRadius: '50%',
        background: outerBg,
        border: `${winning || selected ? 3 : 2}px solid ${borderColor}`,
        boxShadow: winning
          ? '0 0 18px rgba(253, 224, 71, 0.85), 0 4px 10px rgba(0,0,0,0.5)'
          : selected
          ? '0 0 14px rgba(255, 255, 255, 0.7), 0 6px 12px rgba(0,0,0,0.55)'
          : '0 4px 8px rgba(0, 0, 0, 0.48), inset 0 2px 4px rgba(255, 255, 255, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        transform: selected ? 'scale(1.07)' : 'scale(1)',
        transition: 'transform 0.14s ease, box-shadow 0.14s ease',
        flexShrink: 0,
      }}
    >
      {/* 同心カップの立体リング */}
      <span
        style={{
          width: '62%',
          height: '62%',
          borderRadius: '50%',
          background: isAmber
            ? 'radial-gradient(circle at 65% 70%, #fbbf24 0%, #d97706 65%, #9a3412 100%)'
            : 'radial-gradient(circle at 65% 70%, #7dd3fc 0%, #0284c7 65%, #0c4a6e 100%)',
          border: `1.5px solid ${ringHighlight}`,
          boxShadow: `inset 0 2px 4px ${innerRim}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontSize: compact ? (size === 1 ? 9 : 11) : size === 3 ? 13 : size === 2 ? 11 : 9,
            fontWeight: 900,
            color: '#ffffff',
            textShadow: '0 1px 2px rgba(0,0,0,0.65)',
            lineHeight: 1,
          }}
        >
          {SIZE_NAMES[size]}
        </span>
      </span>
    </span>
  );
};

export const GobbletBoard: React.FC<GobbletBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [rawSelection, setRawSelection] = useState<Selection>(null);
  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const winner = state.players.find((p) => p.id === state.winnerId);

  const myPlayer = state.players.find((p) => p.id === state.myId);
  const activePaletteSide: 0 | 1 = isLocalPassAndPlay
    ? state.turnIndex
    : myPlayer
    ? myPlayer.side
    : 0;

  // 手番や盤面が変わったときに無効な選択を自動でクリア
  const selection: Selection = useMemo(() => {
    if (!isMyTurn || !rawSelection) return null;
    if (rawSelection.kind === 'reserve') {
      if (state.reserves[current.side][rawSelection.size] > 0) return rawSelection;
      return null;
    }
    if (!state.rules.allowBoardMove) return null;
    const cell = state.visibleBoard[rawSelection.coord.row]?.[rawSelection.coord.col];
    if (cell?.top && cell.top.owner === current.side && cell.top.size === rawSelection.size) {
      return rawSelection;
    }
    return null;
  }, [isMyTurn, rawSelection, state.reserves, state.visibleBoard, state.rules.allowBoardMove, current.side]);

  const winningSet = useMemo(() => {
    const set = new Set<string>();
    for (const c of state.winningLine) {
      set.add(`${c.row},${c.col}`);
    }
    return set;
  }, [state.winningLine]);

  // 選択中の駒が置ける/移動できるマス集合
  const validTargets = useMemo(() => {
    const set = new Set<string>();
    if (!isMyTurn || !selection) return set;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        if (
          selection.kind === 'board' &&
          selection.coord.row === r &&
          selection.coord.col === c
        ) {
          continue;
        }
        const top = state.visibleBoard[r][c].top;
        if (!top || top.size < selection.size) {
          set.add(`${r},${c}`);
        }
      }
    }
    return set;
  }, [isMyTurn, selection, state.visibleBoard]);

  // 盤上から動かせる自駒か判定
  const canPickBoardCell = (r: number, c: number, top: GobbletPiece | null): boolean => {
    if (!isMyTurn || !state.rules.allowBoardMove || !top || top.owner !== current.side) {
      return false;
    }
    // 移動先が1つ以上あるか
    for (let tr = 0; tr < 3; tr++) {
      for (let tc = 0; tc < 3; tc++) {
        if (tr === r && tc === c) continue;
        const t = state.visibleBoard[tr][tc].top;
        if (!t || t.size < top.size) return true;
      }
    }
    return false;
  };

  const handleCellClick = (r: number, c: number) => {
    if (!isMyTurn) return;
    const cell = state.visibleBoard[r][c];
    const key = `${r},${c}`;

    // 選択中なら配置または移動先として優先判定
    if (selection && validTargets.has(key)) {
      if (selection.kind === 'reserve') {
        setRawSelection(null);
        onAction({
          type: 'place',
          payload: { size: selection.size, toRow: r, toCol: c },
        });
        return;
      }
      setRawSelection(null);
      onAction({
        type: 'move',
        payload: {
          fromRow: selection.coord.row,
          fromCol: selection.coord.col,
          toRow: r,
          toCol: c,
        },
      });
      return;
    }

    // 同じ盤上駒をタップしたら選択解除
    if (
      selection?.kind === 'board' &&
      selection.coord.row === r &&
      selection.coord.col === c
    ) {
      setRawSelection(null);
      return;
    }

    // 自分の盤上駒を選択（盤上移動が有効なとき）
    if (canPickBoardCell(r, c, cell.top)) {
      setRawSelection({ kind: 'board', coord: { row: r, col: c }, size: cell.top!.size });
      return;
    }

    setRawSelection(null);
  };

  const handleReserveClick = (size: GobbletSize) => {
    if (!isMyTurn) return;
    if (state.reserves[current.side][size] <= 0) return;
    if (selection?.kind === 'reserve' && selection.size === size) {
      setRawSelection(null);
    } else {
      setRawSelection({ kind: 'reserve', size });
    }
  };

  const paletteReserves = state.reserves[activePaletteSide];

  return (
    <div className="board-container">
      {/* プレイヤーバー */}
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && current.id === p.id;
          const isAmber = p.side === 0;
          const accent = isAmber ? '#f59e0b' : '#38bdf8';
          const res = state.reserves[p.side];
          const totalLeft = res[1] + res[2] + res[3];
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
                    background: isAmber
                      ? 'radial-gradient(circle at 35% 30%, #fde68a, #ea580c)'
                      : 'radial-gradient(circle at 35% 30%, #e0f2fe, #0284c7)',
                    boxShadow: `0 0 8px ${accent}`,
                    flexShrink: 0,
                  }}
                />
                <span>{p.name}</span>
              </div>
              <div className="opp-meta" style={{ color: isAmber ? '#fde68a' : '#bae6fd' }}>
                控え 大{res[3]} 中{res[2]} 小{res[1]}（計{totalLeft}）
              </div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* 3x3 木目ボード */}
      <div
        className="board-center-wrap"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '6px 0',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 344,
            padding: 12,
            borderRadius: 20,
            background: 'linear-gradient(145deg, #5c3a21 0%, #3b2210 55%, #271509 100%)',
            border: '2px solid rgba(226, 179, 122, 0.42)',
            boxShadow: '0 14px 32px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255,255,255,0.12)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            {state.visibleBoard.map((row, r) =>
              row.map((cell, c) => {
                const key = `${r},${c}`;
                const isSelected =
                  selection?.kind === 'board' &&
                  selection.coord.row === r &&
                  selection.coord.col === c;
                const isTarget = validTargets.has(key);
                const isWin = winningSet.has(key);
                const isLastTo =
                  state.lastMove?.to.row === r && state.lastMove?.to.col === c;
                const isLastFrom =
                  state.lastMove?.from?.row === r && state.lastMove?.from?.col === c;
                const pickable = !selection && canPickBoardCell(r, c, cell.top);
                const interactive = isMyTurn && (isTarget || isSelected || canPickBoardCell(r, c, cell.top));

                const tileBg = isWin
                  ? 'linear-gradient(145deg, #713f12, #422006)'
                  : isSelected
                  ? 'linear-gradient(145deg, #7c4a1e, #543112)'
                  : isTarget
                  ? 'linear-gradient(145deg, #365314, #1a2e05)'
                  : 'linear-gradient(145deg, #c99d6c, #ad7c4b)';

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!interactive}
                    onClick={() => handleCellClick(r, c)}
                    aria-label={`行${r + 1} 列${c + 1}`}
                    style={{
                      aspectRatio: '1',
                      borderRadius: 14,
                      border: isWin
                        ? '2.5px solid #fde047'
                        : isSelected
                        ? '2.5px solid #ffffff'
                        : isTarget
                        ? '2.5px solid #86efac'
                        : isLastTo
                        ? '2px solid rgba(254, 240, 138, 0.85)'
                        : isLastFrom
                        ? '1.5px dashed rgba(255, 255, 255, 0.5)'
                        : pickable
                        ? '2px solid rgba(254, 240, 138, 0.55)'
                        : '1.5px solid rgba(59, 34, 16, 0.65)',
                      background: tileBg,
                      boxShadow: isTarget
                        ? 'inset 0 0 14px rgba(134, 239, 172, 0.35), 0 3px 8px rgba(0,0,0,0.35)'
                        : 'inset 0 2px 6px rgba(255, 255, 255, 0.22), inset 0 -3px 8px rgba(59, 34, 16, 0.38)',
                      position: 'relative',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: interactive ? 'pointer' : 'default',
                      transition: 'transform 0.12s ease, border-color 0.12s ease',
                    }}
                  >
                    {/* 駒本体 */}
                    {cell.top && (
                      <CupPiece
                        owner={cell.top.owner}
                        size={cell.top.size}
                        selected={isSelected}
                        winning={isWin}
                      />
                    )}

                    {/* 空マスの配置先ガイド */}
                    {!cell.top && isTarget && (
                      <span
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: 'rgba(134, 239, 172, 0.85)',
                          boxShadow: '0 0 12px rgba(134, 239, 172, 0.75)',
                        }}
                      />
                    )}

                    {/* かぶせ可能な相手/自駒の上のガイドリング */}
                    {cell.top && isTarget && (
                      <span
                        style={{
                          position: 'absolute',
                          inset: 5,
                          borderRadius: 10,
                          border: '2px dashed rgba(134, 239, 172, 0.9)',
                          pointerEvents: 'none',
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
            {state.winnerId === null
              ? '引き分け！'
              : isLocalPassAndPlay
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

      {/* 下部 控え駒パレット（スマホ縦画面向け sticky-bottom-bar） */}
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
                : selection?.kind === 'reserve'
                ? `${SIZE_NAMES[selection.size]}駒を置くマスをタップ`
                : selection?.kind === 'board'
                ? '移動先のマスをタップ'
                : state.rules.allowBoardMove
                ? '控え駒を選ぶか、盤上の自駒をタップ'
                : '置く控え駒をタップ'}
            </span>
            {selection && (
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setRawSelection(null)}
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
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 8,
            }}
          >
            {([3, 2, 1] as GobbletSize[]).map((size) => {
              const count = paletteReserves[size];
              const isSelected = selection?.kind === 'reserve' && selection.size === size;
              const disabled = !isMyTurn || count <= 0 || activePaletteSide !== current.side;
              return (
                <button
                  key={size}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleReserveClick(size)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    padding: '8px 6px',
                    borderRadius: 12,
                    border: isSelected
                      ? '2px solid #fde047'
                      : '1.5px solid rgba(255, 255, 255, 0.16)',
                    background: isSelected
                      ? 'rgba(245, 158, 11, 0.22)'
                      : 'rgba(15, 23, 42, 0.65)',
                    color: '#f8fafc',
                    cursor: disabled ? 'default' : 'pointer',
                    opacity: count <= 0 ? 0.38 : !isMyTurn ? 0.65 : 1,
                    minHeight: 58,
                  }}
                >
                  <CupPiece owner={activePaletteSide} size={size} selected={isSelected} compact />
                  <div style={{ textAlign: 'left', lineHeight: 1.2 }}>
                    <div style={{ fontSize: 12, fontWeight: 800 }}>{SIZE_NAMES[size]}</div>
                    <div style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 700 }}>
                      残 {count}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
