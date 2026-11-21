import React, { useEffect, useRef, useState } from 'react';
import { Dices, Trophy } from 'lucide-react';
import type { ChinchiroClientState } from '../../games/chinchiro';
import { Dice3D } from '../Dice3D';

interface ChinchiroBoardProps {
  state: ChinchiroClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

export const ChinchiroBoard: React.FC<ChinchiroBoardProps> = ({ state, onAction }) => {
  const [rollingFlags, setRollingFlags] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const [displayDice, setDisplayDice] = useState<[number, number, number]>([1, 2, 3]);
  const [bowlLabel, setBowlLabel] = useState<string>('サイコロを振ってください');
  const prevLogRef = useRef(state.lastLog);

  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const dealer = state.players[state.dealerIndex];

  const activeHand =
    current.currentHand ??
    state.players.find((p) => p.currentHand !== null)?.currentHand ??
    null;

  useEffect(() => {
    if (prevLogRef.current === state.lastLog) return;
    prevLogRef.current = state.lastLog;

    const targetDice: [number, number, number] = activeHand?.dice ?? [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
    ];
    const targetLabel = activeHand?.label ?? state.lastLog;

    setRollingFlags([true, true, true]);
    setBowlLabel('転がっています…');

    const spinTimer = window.setInterval(() => {
      setDisplayDice([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1,
      ]);
    }, 75);

    const t1 = window.setTimeout(() => {
      setRollingFlags([false, true, true]);
      setDisplayDice((prev) => [targetDice[0], prev[1], prev[2]]);
    }, 450);

    const t2 = window.setTimeout(() => {
      setRollingFlags([false, false, true]);
      setDisplayDice((prev) => [targetDice[0], targetDice[1], prev[2]]);
    }, 750);

    const t3 = window.setTimeout(() => {
      window.clearInterval(spinTimer);
      setRollingFlags([false, false, false]);
      setDisplayDice(targetDice);
      setBowlLabel(targetLabel);
    }, 1050);

    return () => {
      window.clearInterval(spinTimer);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [state.lastLog]);

  const isAnyRolling = rollingFlags[0] || rollingFlags[1] || rollingFlags[2];

  const handleRoll = () => {
    if (!isMyTurn || isAnyRolling) return;
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

      <div className="chinchiro-bowl-stage">
        <div className={`chinchiro-bowl ${isAnyRolling ? 'shaking' : ''}`}>
          <div className="bowl-dice-cluster">
            <div className={`bowl-die-slot slot-0 ${rollingFlags[0] ? 'tumbling' : 'landed'}`}>
              <Dice3D value={displayDice[0]} size="lg" />
            </div>
            <div className={`bowl-die-slot slot-1 ${rollingFlags[1] ? 'tumbling' : 'landed'}`}>
              <Dice3D value={displayDice[1]} size="lg" />
            </div>
            <div className={`bowl-die-slot slot-2 ${rollingFlags[2] ? 'tumbling' : 'landed'}`}>
              <Dice3D value={displayDice[2]} size="lg" />
            </div>
          </div>
        </div>
        <div className={`bowl-result-banner ${!isAnyRolling && activeHand ? 'pop' : ''}`}>
          {bowlLabel}
        </div>
      </div>

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
                        <Dice3D key={i} value={d} size="sm" />
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
            disabled={!isMyTurn || isAnyRolling}
            onClick={handleRoll}
          >
            <Dices size={18} />
            {isAnyRolling
              ? 'サイコロを振っています…'
              : isMyTurn
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
