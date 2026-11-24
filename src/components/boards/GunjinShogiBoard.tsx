import React, { useMemo, useState } from 'react';
import { Check, Flag, Shield, Shuffle, Swords } from 'lucide-react';
import {
  GUNJIN_COLS,
  GUNJIN_ROWS,
  type GunjinCoord,
  type GunjinPieceType,
  type GunjinShogiClientState,
  PIECE_LABELS,
  isBridgeCol,
  isHeadquarters,
} from '../../games/gunjinshogi';

interface GunjinShogiBoardProps {
  state: GunjinShogiClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
  isLocalPassAndPlay?: boolean;
}

export const GunjinShogiBoard: React.FC<GunjinShogiBoardProps> = ({
  state,
  onAction,
  isLocalPassAndPlay = false,
}) => {
  const [selected, setSelected] = useState<GunjinCoord | null>(null);

  const current = state.players[state.turnIndex];
  const mySide = state.mySide;
  const myPlayer = mySide !== null ? state.players[mySide] : null;
  const isMyBattleTurn =
    state.phase === 'playing' && state.subPhase === 'battle' && current.id === state.myId;
  const isMySetup =
    state.phase === 'playing' &&
    state.subPhase === 'setup' &&
    myPlayer !== null &&
    !myPlayer.setupConfirmed;
  const winner = state.players.find((p) => p.id === state.winnerId);

  // P1視点なら上下左右を180度反転して自陣を下に表示
  const flipped = mySide === 1;
  const displayRows = useMemo(
    () =>
      flipped
        ? Array.from({ length: GUNJIN_ROWS }, (_, i) => GUNJIN_ROWS - 1 - i)
        : Array.from({ length: GUNJIN_ROWS }, (_, i) => i),
    [flipped]
  );
  const displayCols = useMemo(
    () =>
      flipped
        ? Array.from({ length: GUNJIN_COLS }, (_, i) => GUNJIN_COLS - 1 - i)
        : Array.from({ length: GUNJIN_COLS }, (_, i) => i),
    [flipped]
  );

  // 動かせる駒の集合
  const movableSources = useMemo(() => {
    const set = new Set<string>();
    if (!isMyBattleTurn) return set;
    for (const m of state.validMoves) {
      set.add(`${m.fromRow},${m.fromCol}`);
    }
    return set;
  }, [isMyBattleTurn, state.validMoves]);

  // 選択中駒の移動先集合
  const targetSet = useMemo(() => {
    const set = new Set<string>();
    if (!isMyBattleTurn || !selected) return set;
    for (const m of state.validMoves) {
      if (m.fromRow === selected.row && m.fromCol === selected.col) {
        set.add(`${m.toRow},${m.toCol}`);
      }
    }
    return set;
  }, [isMyBattleTurn, selected, state.validMoves]);

  const selectedPiece = selected ? state.board[selected.row]?.[selected.col] ?? null : null;

  const isOwnTerritory = (r: number) =>
    mySide === 0 ? r >= 4 && r <= 7 : mySide === 1 ? r >= 0 && r <= 3 : false;

  const handleCellClick = (r: number, c: number) => {
    if (isMySetup) {
      if (!isOwnTerritory(r)) return;
      if (!selected) {
        setSelected({ row: r, col: c });
        return;
      }
      if (selected.row === r && selected.col === c) {
        setSelected(null);
        return;
      }
      onAction({
        type: 'swapSetup',
        payload: { r1: selected.row, c1: selected.col, r2: r, c2: c },
      });
      setSelected(null);
      return;
    }

    if (!isMyBattleTurn) return;

    if (selected && targetSet.has(`${r},${c}`)) {
      onAction({
        type: 'move',
        payload: { fromRow: selected.row, fromCol: selected.col, toRow: r, toCol: c },
      });
      setSelected(null);
      return;
    }

    if (movableSources.has(`${r},${c}`)) {
      if (selected && selected.row === r && selected.col === c) {
        setSelected(null);
      } else {
        setSelected({ row: r, col: c });
      }
      return;
    }

    setSelected(null);
  };

  // 直前の衝突結果バナー
  const battleBanner = useMemo(() => {
    const b = state.lastBattle;
    if (!b || state.subPhase !== 'battle') return null;
    if (mySide === null) {
      if (b.outcome === 'draw') return { text: '直前の衝突：相打ち（両者消滅）', color: '#fbbf24' };
      const winName =
        b.outcome === 'attackerWin'
          ? state.players[b.attackerSide].name
          : state.players[b.attackerSide === 0 ? 1 : 0].name;
      return { text: `直前の衝突：${winName} が勝利`, color: '#38bdf8' };
    }
    const iWasAttacker = b.attackerSide === mySide;
    if (b.outcome === 'draw') {
      return { text: '衝突結果：相打ち（両者消滅）', color: '#fbbf24' };
    }
    const iWon =
      (iWasAttacker && b.outcome === 'attackerWin') ||
      (!iWasAttacker && b.outcome === 'defenderWin');
    return iWon
      ? { text: '衝突結果：味方の駒が勝利しました！', color: '#4ade80' }
      : { text: '衝突結果：味方の駒が敗北しました…', color: '#f87171' };
  }, [state.lastBattle, state.subPhase, state.players, mySide]);

  return (
    <div className="board-container">
      {/* プレイヤーバー */}
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active =
            state.phase === 'playing' &&
            ((state.subPhase === 'battle' && current.id === p.id) ||
              (state.subPhase === 'setup' &&
                (isLocalPassAndPlay ? p.id === state.myId : !p.setupConfirmed)));
          const accent = p.side === 0 ? '#10b981' : '#f43f5e';
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
                    width: 9,
                    height: 9,
                    borderRadius: '50%',
                    background: accent,
                    flexShrink: 0,
                  }}
                />
                <span>{p.name}</span>
              </div>
              <div className="opp-meta">
                {state.subPhase === 'setup'
                  ? p.setupConfirmed
                    ? '配置完了'
                    : '配置中'
                  : `残駒 ${state.remainingCounts[p.side]}`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      {/* 衝突結果バナー */}
      {battleBanner && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            padding: '5px 12px',
            borderRadius: 999,
            background: 'rgba(15, 23, 42, 0.82)',
            border: `1px solid ${battleBanner.color}`,
            color: battleBanner.color,
            fontSize: 12,
            fontWeight: 800,
            margin: '0 auto 4px',
            width: 'fit-content',
          }}
        >
          <Swords size={13} />
          <span>{battleBanner.text}</span>
        </div>
      )}

      {/* 選択駒の簡易説明（選択時のみ表示） */}
      {selectedPiece && selectedPiece.type !== 'hidden' && (
        <div
          style={{
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: '#fde68a',
            marginBottom: 4,
          }}
        >
          {PIECE_LABELS[selectedPiece.type as GunjinPieceType].name}：
          {PIECE_LABELS[selectedPiece.type as GunjinPieceType].rankText}
        </div>
      )}

      {state.subPhase === 'setup' && myPlayer?.setupConfirmed && (
        <div className="waiting-banner" style={{ marginBottom: 6 }}>
          相手の作戦配置が完了するのを待っています...
        </div>
      )}

      {/* 6x8 作戦盤 */}
      <div
        className="board-center-wrap"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          gap: 8,
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 382,
            background: 'linear-gradient(180deg, #1b2820 0%, #111b15 100%)',
            border: '2px solid rgba(148, 163, 184, 0.35)',
            borderRadius: 14,
            padding: 8,
            boxShadow: '0 10px 26px rgba(0, 0, 0, 0.48)',
          }}
        >
          {displayRows.map((r, rIdx) => (
            <React.Fragment key={r}>
              {/* 行 3 と 行 4 の間に川と2本の橋を描画 */}
              {rIdx === 4 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${GUNJIN_COLS}, minmax(0, 1fr))`,
                    gap: 3,
                    margin: '4px 0',
                    height: 16,
                    alignItems: 'center',
                  }}
                >
                  {displayCols.map((c) => {
                    const bridge = isBridgeCol(c);
                    return (
                      <div
                        key={`river-${c}`}
                        style={{
                          height: '100%',
                          borderRadius: 4,
                          background: bridge
                            ? 'linear-gradient(180deg, #a16207, #713f12)'
                            : 'linear-gradient(180deg, #0369a1, #0c4a6e)',
                          border: bridge
                            ? '1px solid #facc15'
                            : '1px solid rgba(56, 189, 248, 0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 900,
                          color: bridge ? '#fef08a' : '#7dd3fc',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {bridge ? '橋' : '川'}
                      </div>
                    );
                  })}
                </div>
              )}

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${GUNJIN_COLS}, minmax(0, 1fr))`,
                  gap: 3,
                  marginBottom: rIdx === 3 || rIdx === 7 ? 0 : 3,
                }}
              >
                {displayCols.map((c) => {
                  const cell = state.board[r][c];
                  const isSelected = selected?.row === r && selected?.col === c;
                  const isTarget = targetSet.has(`${r},${c}`);
                  const isMovable = movableSources.has(`${r},${c}`);
                  const isSetupEditable = isMySetup && isOwnTerritory(r);
                  const isHq0 = isHeadquarters(r, c, 0);
                  const isHq1 = isHeadquarters(r, c, 1);
                  const isHq = isHq0 || isHq1;
                  const isEnemyHq = mySide !== null && isHeadquarters(r, c, mySide === 0 ? 1 : 0);
                  const isLastTo =
                    state.lastMove?.toRow === r && state.lastMove?.toCol === c;

                  const interactive = isSetupEditable || isTarget || isMovable;

                  // 駒の色判定（自分=青緑、敵=クリムゾン）
                  const isMyPiece = cell && mySide !== null && cell.owner === mySide;
                  const isHidden = cell?.type === 'hidden';
                  const pieceLabel =
                    cell && !isHidden ? PIECE_LABELS[cell.type as GunjinPieceType].short : '';
                  const isSpecialPiece =
                    cell &&
                    !isHidden &&
                    (cell.type === 'taisho' ||
                      cell.type === 'gunki' ||
                      cell.type === 'jirai' ||
                      cell.type === 'spy');

                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      disabled={!interactive}
                      onClick={() => handleCellClick(r, c)}
                      aria-label={`行${r + 1} 列${c + 1}`}
                      style={{
                        height: 44,
                        borderRadius: 6,
                        padding: 2,
                        position: 'relative',
                        border: isSelected
                          ? '2px solid #fde047'
                          : isTarget
                          ? '2px solid #4ade80'
                          : isLastTo
                          ? '1.5px solid #fbbf24'
                          : isHq
                          ? `1.5px solid ${isEnemyHq ? '#f43f5e' : '#38bdf8'}`
                          : '1px solid rgba(148, 163, 184, 0.22)',
                        background: isTarget
                          ? 'rgba(34, 197, 94, 0.28)'
                          : isHq
                          ? isEnemyHq
                            ? 'rgba(244, 63, 94, 0.16)'
                            : 'rgba(56, 189, 248, 0.14)'
                          : isSetupEditable
                          ? 'rgba(30, 58, 44, 0.72)'
                          : 'rgba(20, 35, 28, 0.65)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: interactive ? 'pointer' : 'default',
                      }}
                    >
                      {/* 総司令部背景マーク */}
                      {isHq && !cell && (
                        <span
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 1,
                            color: isEnemyHq ? '#fda4af' : '#7dd3fc',
                            fontSize: 8,
                            fontWeight: 800,
                            opacity: 0.85,
                          }}
                        >
                          <Flag size={11} />
                          司令
                        </span>
                      )}

                      {/* 駒タイル */}
                      {cell && (
                        <span
                          style={{
                            width: '100%',
                            height: '100%',
                            borderRadius: 5,
                            background: isHidden
                              ? 'linear-gradient(160deg, #475569, #1e293b)'
                              : isMyPiece || (mySide === null && cell.owner === 0)
                              ? isSpecialPiece
                                ? 'linear-gradient(160deg, #0f766e, #115e59)'
                                : 'linear-gradient(160deg, #065f46, #064e3b)'
                              : 'linear-gradient(160deg, #9f1239, #881337)',
                            border: isSelected
                              ? '1.5px solid #fde047'
                              : isMovable
                              ? '1.5px solid rgba(134, 239, 172, 0.75)'
                              : isHidden
                              ? '1px solid #64748b'
                              : '1px solid rgba(255, 255, 255, 0.35)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isHidden ? '#cbd5e1' : '#f8fafc',
                            fontSize: 12,
                            fontWeight: 900,
                            letterSpacing: '0.02em',
                          }}
                        >
                          {isHidden ? <Shield size={14} opacity={0.7} /> : pieceLabel}
                        </span>
                      )}

                      {/* 移動先ドット（空きマス時） */}
                      {!cell && isTarget && (
                        <span
                          style={{
                            position: 'absolute',
                            width: 11,
                            height: 11,
                            borderRadius: '50%',
                            background: '#4ade80',
                            boxShadow: '0 0 8px rgba(74, 222, 128, 0.9)',
                          }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* SETUP 操作ボタン */}
        {isMySetup && (
          <div
            className="action-bar"
            style={{ width: '100%', maxWidth: 382 }}
          >
            {state.rules.autoSetupAllowed && (
              <button
                type="button"
                className="secondary-btn flex-1"
                onClick={() => {
                  setSelected(null);
                  onAction({ type: 'autoSetup' });
                }}
              >
                <Shuffle size={15} /> ランダム配置
              </button>
            )}
            <button
              type="button"
              className="primary-btn flex-1"
              onClick={() => {
                setSelected(null);
                onAction({ type: 'confirmSetup' });
              }}
            >
              <Check size={16} /> 配置完了
            </button>
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
          <p className="panel-desc">盤上の全駒の正体を公開しました</p>
        </div>
      )}
    </div>
  );
};
