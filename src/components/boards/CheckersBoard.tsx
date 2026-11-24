import React, { useMemo, useState } from 'react';
import { Crown } from 'lucide-react';
import type { CheckersClientState, CheckersCoord } from '../../games/checkers';

interface CheckersBoardProps {
  state: CheckersClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

export const CheckersBoard: React.FC<CheckersBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [manualSelected, setManualSelected] = useState<CheckersCoord | null>(null);
  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const winner = state.players.find((p) => p.id === state.winnerId);

  // 連続ジャンプ中は該当駒を自動選択
  const selected: CheckersCoord | null = useMemo(() => {
    if (!isMyTurn) return null;
    if (state.mustContinueFrom) return state.mustContinueFrom;
    if (
      manualSelected &&
      state.validMoves.some(
        (m) => m.fromRow === manualSelected.row && m.fromCol === manualSelected.col
      )
    ) {
      return manualSelected;
    }
    return null;
  }, [isMyTurn, state.mustContinueFrom, manualSelected, state.validMoves]);

  // 動かせる駒の集合
  const movableSources = useMemo(() => {
    const set = new Set<string>();
    if (!isMyTurn) return set;
    for (const m of state.validMoves) {
      set.add(`${m.fromRow},${m.fromCol}`);
    }
    return set;
  }, [isMyTurn, state.validMoves]);

  // 選択中駒の移動先マップ
  const targetMoves = useMemo(() => {
    const map = new Map<string, boolean>(); // key -> isCapture
    if (!selected) return map;
    for (const m of state.validMoves) {
      if (m.fromRow === selected.row && m.fromCol === selected.col) {
        map.set(`${m.toRow},${m.toCol}`, m.captured !== null);
      }
    }
    return map;
  }, [selected, state.validMoves]);

  const hasCaptureAvailable = isMyTurn && state.validMoves.some((m) => m.captured !== null);

  const handleCellClick = (r: number, c: number) => {
    if (!isMyTurn) return;

    // 移動先をタップした場合
    if (selected && targetMoves.has(`${r},${c}`)) {
      setManualSelected(null);
      onAction({
        type: 'move',
        payload: { fromRow: selected.row, fromCol: selected.col, toRow: r, toCol: c },
      });
      return;
    }

    // 連続ジャンプ中は他の駒を選べない
    if (state.mustContinueFrom) return;

    // 自分の動かせる駒をタップした場合
    if (movableSources.has(`${r},${c}`)) {
      if (selected && selected.row === r && selected.col === c) {
        setManualSelected(null);
      } else {
        setManualSelected({ row: r, col: c });
      }
      return;
    }

    setManualSelected(null);
  };

  return (
    <div className="board-container">
      {/* プレイヤーバー */}
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = state.phase === 'playing' && current.id === p.id;
          const isRed = p.side === 0;
          const accent = isRed ? '#ef4444' : '#e2e8f0';
          return (
            <div
              key={p.id}
              className={`opp-pill ${active ? 'active' : ''} ${
                !isLocalPassAndPlay && p.id === state.myId ? 'me' : ''
              }`}
              style={active ? { borderColor: isRed ? '#ef4444' : '#cbd5e1' } : undefined}
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
                      : 'radial-gradient(circle at 35% 30%, #f8fafc, #64748b)',
                    border: `1.5px solid ${accent}`,
                    flexShrink: 0,
                  }}
                />
                <span>{p.name}</span>
              </div>
              <div className="opp-meta">残駒 {state.counts[p.side]}</div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {hasCaptureAvailable && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: '#fde047',
            marginBottom: 4,
          }}
        >
          {state.mustContinueFrom
            ? '連続ジャンプ中！光っている移動先をタップ'
            : state.rules.forcedCapture
            ? '飛び越し捕獲が可能です（捕獲優先ルール）'
            : '飛び越し捕獲が可能です'}
        </div>
      )}

      {/* 8x8 木目調チェッカー盤 */}
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
            maxWidth: 388,
            padding: 8,
            borderRadius: 14,
            background: 'linear-gradient(145deg, #4b2e19, #2b180b)',
            border: '2px solid rgba(217, 173, 124, 0.38)',
            boxShadow: '0 10px 26px rgba(0, 0, 0, 0.48)',
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
              borderRadius: 6,
              overflow: 'hidden',
              border: '1.5px solid #1c1008',
            }}
          >
            {state.board.map((row, r) =>
              row.map((cell, c) => {
                const isDark = (r + c) % 2 === 1;
                const isSelected = selected?.row === r && selected?.col === c;
                const isTarget = targetMoves.has(`${r},${c}`);
                const isCaptureTarget = targetMoves.get(`${r},${c}`) === true;
                const isMovable = movableSources.has(`${r},${c}`);
                const isLastFrom =
                  state.lastMove?.fromRow === r && state.lastMove?.fromCol === c;
                const isLastTo =
                  state.lastMove?.toRow === r && state.lastMove?.toCol === c;

                const squareBg = !isDark
                  ? '#e6cfa9'
                  : isSelected
                  ? '#9a6b2f'
                  : isTarget
                  ? isCaptureTarget
                    ? '#854d0e'
                    : '#3f6212'
                  : isLastTo || isLastFrom
                  ? '#7c5330'
                  : '#6d4425';

                const interactive = isTarget || isMovable;

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    disabled={!interactive}
                    onClick={() => handleCellClick(r, c)}
                    aria-label={`行${r + 1} 列${c + 1}`}
                    style={{
                      aspectRatio: '1',
                      border: 'none',
                      padding: 0,
                      background: squareBg,
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: interactive ? 'pointer' : 'default',
                      boxShadow: isSelected
                        ? 'inset 0 0 0 2.5px #fde047'
                        : isTarget
                        ? `inset 0 0 0 2px ${isCaptureTarget ? '#facc15' : '#86efac'}`
                        : 'none',
                    }}
                  >
                    {/* 駒 */}
                    {cell && (
                      <span
                        style={{
                          width: '78%',
                          height: '78%',
                          borderRadius: '50%',
                          background:
                            cell.owner === 0
                              ? 'radial-gradient(circle at 32% 28%, #fca5a5 0%, #dc2626 52%, #7f1d1d 100%)'
                              : 'radial-gradient(circle at 32% 28%, #f8fafc 0%, #cbd5e1 52%, #475569 100%)',
                          border: isSelected
                            ? '2.5px solid #fde047'
                            : isMovable
                            ? '2px solid rgba(254, 240, 138, 0.85)'
                            : cell.owner === 0
                            ? '2px solid #991b1b'
                            : '2px solid #334155',
                          boxShadow:
                            '0 3px 6px rgba(0,0,0,0.45), inset 0 2px 3px rgba(255,255,255,0.35)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transform: isSelected ? 'scale(1.06)' : 'scale(1)',
                          transition: 'transform 0.12s ease',
                        }}
                      >
                        {cell.king && (
                          <Crown
                            size={16}
                            strokeWidth={2.5}
                            color={cell.owner === 0 ? '#fef08a' : '#1e293b'}
                          />
                        )}
                      </span>
                    )}

                    {/* 移動先インジケータ */}
                    {!cell && isTarget && (
                      <span
                        style={{
                          width: isCaptureTarget ? '42%' : '34%',
                          height: isCaptureTarget ? '42%' : '34%',
                          borderRadius: '50%',
                          background: isCaptureTarget
                            ? 'rgba(250, 204, 21, 0.92)'
                            : 'rgba(134, 239, 172, 0.88)',
                          boxShadow: '0 0 8px rgba(0, 0, 0, 0.4)',
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
            {state.players[0].name}: {state.counts[0]}駒 / {state.players[1].name}:{' '}
            {state.counts[1]}駒
          </p>
        </div>
      )}
    </div>
  );
};
