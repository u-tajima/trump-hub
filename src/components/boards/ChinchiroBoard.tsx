import React, { useEffect, useRef, useState } from 'react';
import { Dices, Trophy } from 'lucide-react';
import type { ChinchiroClientState } from '../../games/chinchiro';
import { Dice3D } from '../Dice3D';

interface ChinchiroBoardProps {
  state: ChinchiroClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

export const ChinchiroBoard: React.FC<ChinchiroBoardProps> = ({ state, onAction }) => {
  const [rolling, setRolling] = useState(false);
  const prevLogRef = useRef(state.lastLog);

  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const dealer = state.players[state.dealerIndex];

  useEffect(() => {
    if (prevLogRef.current !== state.lastLog) {
      prevLogRef.current = state.lastLog;
      setRolling(true);
      const t = window.setTimeout(() => setRolling(false), 620);
      return () => window.clearTimeout(t);
    }
  }, [state.lastLog]);

  const handleRoll = () => {
    if (!isMyTurn || rolling) return;
    setRolling(true);
    onAction({ type: 'roll' });
  };

  return (
    <div className="board-container">
      <div className="status-flags">
        <span className="flag-badge info">
          第 {state.round} / {state.rules.rounds} 局
        </span>
        <span className="flag-badge warn">親: {dealer.name}</span>
      </div>

      <div className="log-banner">{state.lastLog}</div>

      <div className="chinchiro-players">
        {state.players.map((p, idx) => {
          const active = state.phase === 'playing' && idx === state.turnIndex;
          const isDealer = idx === state.dealerIndex;
          return (
            <div key={p.id} className={`chinchiro-row ${active ? 'active' : ''} ${p.id === state.myId ? 'me' : ''}`}>
              <div className="chinchiro-row-top">
                <div>
                  <strong>{p.name}</strong>
                  {isDealer && <span className="badge host ml-8">親</span>}
                </div>
                <div className="chinchiro-points">
                  {p.points}点
                  {p.lastDelta !== 0 && (
                    <span className={p.lastDelta > 0 ? 'delta-plus' : 'delta-minus'}>
                      {' '}({p.lastDelta > 0 ? `+${p.lastDelta}` : p.lastDelta})
                    </span>
                  )}
                </div>
              </div>
              <div className="chinchiro-row-hand">
                {p.currentHand ? (
                  <>
                    <span className="dice-trio">
                      {p.currentHand.dice.map((d, i) => (
                        <Dice3D key={i} value={d} rolling={rolling && active} size="sm" />
                      ))}
                    </span>
                    <span className="hand-label">{p.currentHand.label}</span>
                  </>
                ) : (
                  <span className="text-muted-sm">
                    {active ? `残り ${p.rollsLeft} 回` : '待機中'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {state.phase === 'playing' ? (
        <div className="sticky-bottom-bar">
          <button
            type="button"
            className="primary-btn full-width"
            disabled={!isMyTurn}
            onClick={handleRoll}
          >
            <Dices size={18} />
            {isMyTurn
              ? `サイコロを振る（残り ${current.rollsLeft} 回）`
              : `${current.name} が振っています…`}
          </button>
        </div>
      ) : (
        <div className="result-card">
          <h3>
            <Trophy size={18} /> 最終ランキング
          </h3>
          <ul className="result-list">
            {[...state.players]
              .sort((a, b) => b.points - a.points)
              .map((p, idx) => (
                <li key={p.id}>
                  <span>{idx + 1}位 ({p.points}点)</span>
                  <strong>{p.name}</strong>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};
