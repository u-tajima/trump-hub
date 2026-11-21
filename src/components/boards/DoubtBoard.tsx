import React, { useEffect, useState } from 'react';
import type { DoubtClientState } from '../../games/doubt';
import { formatRank } from '../../types/card';
import { PlayingCard } from '../PlayingCard';

interface DoubtBoardProps {
  state: DoubtClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

export const DoubtBoard: React.FC<DoubtBoardProps> = ({ state, onAction }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [remainSec, setRemainSec] = useState(0);

  const isMyTurn =
    state.phase === 'playing' &&
    state.subPhase === 'play' &&
    state.turnPlayerId === state.myId;

  useEffect(() => {
    if (state.subPhase !== 'doubtWindow') {
      setRemainSec(0);
      return;
    }
    const update = () => {
      const diff = Math.max(0, Math.ceil((state.windowEndsAt - Date.now()) / 1000));
      setRemainSec(diff);
    };
    update();
    const id = window.setInterval(update, 200);
    return () => window.clearInterval(id);
  }, [state.subPhase, state.windowEndsAt]);

  const toggleCard = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const handlePlay = () => {
    if (!isMyTurn || selectedIds.length === 0) return;
    onAction({ type: 'play', payload: { cardIds: selectedIds } });
    setSelectedIds([]);
  };

  const canDoubt =
    state.phase === 'playing' &&
    state.subPhase === 'doubtWindow' &&
    state.lastPlayMeta !== null &&
    state.lastPlayMeta.playerId !== state.myId;

  return (
    <div className="board-container">
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = p.id === state.turnPlayerId && state.phase === 'playing';
          return (
            <div key={p.id} className={`opp-pill ${active ? 'active' : ''} ${p.id === state.myId ? 'me' : ''}`}>
              <div className="opp-name">{p.name}</div>
              <div className="opp-meta">{p.handCount}枚</div>
            </div>
          );
        })}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      <div className="table-center doubt-table">
        <div className="doubt-expected-badge">
          今回の宣言数字: <strong>{formatRank(state.expectedRank as 1)}</strong>
        </div>

        <div className="doubt-pile-info">
          <div className="pile-stack">
            {state.pileCount > 0 ? <PlayingCard faceDown size="md" /> : <div className="empty-pile">0枚</div>}
          </div>
          <div className="pile-count">場の枚数: {state.pileCount}枚</div>
        </div>

        {state.subPhase === 'doubtWindow' && state.lastPlayMeta && (
          <div className="doubt-window-box">
            <div className="doubt-window-text">
              {state.lastPlayMeta.playerName} が「{formatRank(state.lastPlayMeta.declaredRank as 1)}」を{' '}
              {state.lastPlayMeta.count}枚 出しました（残り {remainSec}秒）
            </div>
            {canDoubt && (
              <button
                type="button"
                className="danger-btn full-width"
                onClick={() => onAction({ type: 'doubt' })}
              >
                ダウト！
              </button>
            )}
          </div>
        )}

        {state.lastReveal && (
          <div className="reveal-box">
            <div className="reveal-title">
              {state.lastReveal.wasLie ? 'ウソでした！' : '本当でした！'}
            </div>
            <div className="table-cards-row">
              {state.lastReveal.cards.map((c) => (
                <PlayingCard key={c.id} card={c} size="xs" flipIn />
              ))}
            </div>
          </div>
        )}
      </div>

      {state.phase === 'playing' ? (
        <div className="hand-area">
          <div className="hand-header">
            <span>
              {isMyTurn
                ? `「${formatRank(state.expectedRank as 1)}」として1〜4枚を出してください`
                : state.subPhase === 'doubtWindow'
                ? 'ダウト判定中…'
                : '相手のターン待機中…'}
            </span>
          </div>
          <div className="hand-scroll">
            {state.myHand.map((card) => (
              <PlayingCard
                key={card.id}
                card={card}
                size="md"
                selected={selectedIds.includes(card.id)}
                onClick={() => toggleCard(card.id)}
              />
            ))}
          </div>
          <div className="action-bar">
            <button
              type="button"
              className="primary-btn full-width"
              disabled={!isMyTurn || selectedIds.length === 0}
              onClick={handlePlay}
            >
              {selectedIds.length === 0
                ? 'カードを選択（1〜4枚）'
                : `「${formatRank(state.expectedRank as 1)}」として ${selectedIds.length}枚 出す`}
            </button>
          </div>
        </div>
      ) : (
        <div className="result-card">
          <h3>勝者決定！</h3>
          <p className="panel-desc text-center">
            勝者: <strong>{state.players.find((p) => p.id === state.winnerId)?.name}</strong>
          </p>
        </div>
      )}
    </div>
  );
};
