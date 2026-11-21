import React, { useState } from 'react';
import { Flame, Lock, RefreshCw, Trophy } from 'lucide-react';
import { type DaifugoClientState, canPlayOnTable } from '../../games/daifugo';
import { SUIT_SYMBOLS, formatRank } from '../../types/card';
import { PlayingCard } from '../PlayingCard';

interface DaifugoBoardProps {
  state: DaifugoClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

function rankTitle(rank: number | null, total: number, foul: boolean): string {
  if (foul) return '大貧民(反則)';
  if (rank === null) return '';
  if (rank === 1) return '大富豪';
  if (rank === total) return '大貧民';
  if (total >= 4 && rank === 2) return '富豪';
  if (total >= 4 && rank === total - 1) return '貧民';
  return `${rank}位(平民)`;
}

export const DaifugoBoard: React.FC<DaifugoBoardProps> = ({ state, onAction }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const isMyTurn = state.phase === 'playing' && !state.pendingEffect && state.turnPlayerId === state.myId;
  const isMyEffect = state.phase === 'playing' && state.pendingEffect?.playerId === state.myId;

  const toggleCard = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectedCards = state.myHand.filter((c) => selectedIds.includes(c.id));
  const playValidation =
    selectedCards.length > 0
      ? canPlayOnTable(selectedCards, {
          ...state,
          players: [],
          turnIndex: 0,
          table: state.tableTop ? [state.tableTop] : [],
          lastPlayerId: null,
          finishedOrder: [],
          foulOrder: [],
          winnerIdsLastGame: [],
        })
      : { ok: false, reason: 'カードを選択してください' };

  const handlePlay = () => {
    if (!isMyTurn || !playValidation.ok) return;
    onAction({ type: 'play', payload: { cardIds: selectedIds } });
    setSelectedIds([]);
  };

  const handlePass = () => {
    if (!isMyTurn) return;
    setSelectedIds([]);
    onAction({ type: 'pass' });
  };

  const handleResolveEffect = () => {
    if (!isMyEffect || !state.pendingEffect) return;
    if (state.pendingEffect.type === 'sevenPass') {
      onAction({ type: 'resolveSevenPass', payload: { cardIds: selectedIds } });
      setSelectedIds([]);
    } else if (state.pendingEffect.type === 'tenDiscard') {
      onAction({ type: 'resolveTenDiscard', payload: { cardIds: selectedIds } });
      setSelectedIds([]);
    }
  };

  const needCount =
    state.pendingEffect && state.pendingEffect.type !== 'queenBomber'
      ? Math.min(state.pendingEffect.count, state.myHand.length)
      : 0;

  return (
    <div className="board-container">
      <div className="opponents-bar">
        {state.players.map((p) => {
          const active = p.id === state.turnPlayerId && state.phase === 'playing';
          return (
            <div key={p.id} className={`opp-pill ${active ? 'active' : ''} ${p.id === state.myId ? 'me' : ''}`}>
              <div className="opp-name">{p.name}</div>
              <div className="opp-meta">
                {p.finishRank !== null
                  ? rankTitle(p.finishRank, state.players.length, p.foulFinish)
                  : p.passed
                  ? 'PASS'
                  : `手札 ${p.handCount}枚`}
              </div>
            </div>
          );
        })}
      </div>

      <div className="status-flags">
        {state.revolution && (
          <span className="flag-badge danger">
            <Flame size={12} /> 革命中
          </span>
        )}
        {state.elevenBack && (
          <span className="flag-badge warn">
            <RefreshCw size={12} /> 11バック
          </span>
        )}
        {state.suitLock && (
          <span className="flag-badge info">
            <Lock size={12} /> しばり: {state.suitLock.map((s) => SUIT_SYMBOLS[s]).join('')}
          </span>
        )}
        {state.numberLock && (
          <span className="flag-badge info">
            <Lock size={12} /> 激しば中
          </span>
        )}
      </div>

      <div className="log-banner">{state.lastLog}</div>

      <div className="table-center daifugo-table">
        {state.tableTop ? (
          <div className="table-cards-row">
            {state.tableTop.cards.map((card) => (
              <PlayingCard key={card.id} card={card} size="md" animateIn />
            ))}
          </div>
        ) : (
          <div className="empty-table-hint">場にカードがありません（親番）</div>
        )}
      </div>

      {isMyEffect && state.pendingEffect?.type === 'queenBomber' && (
        <div className="card-panel">
          <div className="field-label">Qボンバー：全員から捨てる数字を選択</div>
          <div className="bomber-grid">
            {Array.from({ length: 13 }, (_, idx) => {
              const r = idx + 1;
              return (
                <button
                  key={r}
                  type="button"
                  className="chip-btn accent"
                  onClick={() => onAction({ type: 'resolveQueenBomber', payload: { rank: r } })}
                >
                  {formatRank(r as 1)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {state.phase === 'playing' ? (
        <div className="hand-area">
          <div className="hand-header">
            <span>
              {isMyEffect
                ? state.pendingEffect?.type === 'sevenPass'
                  ? `7渡し：渡すカードを ${needCount}枚 選択`
                  : state.pendingEffect?.type === 'tenDiscard'
                  ? `10捨て：捨てるカードを ${needCount}枚 選択`
                  : 'Qボンバー発動中'
                : isMyTurn
                ? 'あなたのターン'
                : '相手のターン待機中'}
            </span>
            {selectedIds.length > 0 && (
              <button type="button" className="text-link-btn" onClick={() => setSelectedIds([])}>
                選択解除 ({selectedIds.length})
              </button>
            )}
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
          {isMyEffect && state.pendingEffect?.type !== 'queenBomber' ? (
            <div className="action-bar">
              <button
                type="button"
                className="primary-btn full-width"
                disabled={selectedIds.length !== needCount}
                onClick={handleResolveEffect}
              >
                {selectedIds.length === needCount
                  ? `${needCount}枚を確定する`
                  : `あと ${Math.max(0, needCount - selectedIds.length)} 枚選択してください`}
              </button>
            </div>
          ) : (
            <div className="action-bar">
              <button type="button" className="secondary-btn" disabled={!isMyTurn} onClick={handlePass}>
                パス
              </button>
              <button
                type="button"
                className="primary-btn flex-1"
                disabled={!isMyTurn || !playValidation.ok}
                onClick={handlePlay}
              >
                {selectedIds.length === 0
                  ? 'カードを選んで出す'
                  : playValidation.ok
                  ? `${selectedIds.length}枚を出す`
                  : playValidation.reason}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="result-card">
          <h3>
            <Trophy size={18} /> 結果発表
          </h3>
          <ul className="result-list">
            {[...state.players]
              .sort((a, b) => (a.finishRank ?? 99) - (b.finishRank ?? 99))
              .map((p) => (
                <li key={p.id}>
                  <span>{rankTitle(p.finishRank, state.players.length, p.foulFinish)}</span>
                  <strong>{p.name}</strong>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};
