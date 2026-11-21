import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dices, Hand, Trophy, Volume2, VolumeX } from 'lucide-react';
import type { ChinchiroClientState } from '../../games/chinchiro';
import { type BowlSimMode, ChinchiroBowl3D } from '../ChinchiroBowl3D';
import { Dice3D } from '../Dice3D';

interface ChinchiroBoardProps {
  state: ChinchiroClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

export const ChinchiroBoard: React.FC<ChinchiroBoardProps> = ({ state, onAction }) => {
  const [simMode, setSimMode] = useState<BowlSimMode>('idle');
  const [targetDice, setTargetDice] = useState<[number, number, number]>([1, 2, 3]);
  const [bowlLabel, setBowlLabel] = useState<string>('茶碗を振ってスタート');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const awaitingResultRef = useRef<boolean>(false);
  const prevLogRef = useRef<string>(state.lastLog);
  const pendingLabelRef = useRef<string>('');

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

    const dice: [number, number, number] = activeHand?.dice ?? [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1,
    ];
    pendingLabelRef.current = activeHand?.label ?? state.lastLog;
    setTargetDice(dice);

    if (awaitingResultRef.current) {
      awaitingResultRef.current = false;
      setSimMode('settling');
      setBowlLabel('出目を判定中…');
    } else {
      setSimMode('shaking');
      setBowlLabel('茶碗を振っています…');
      const timer = window.setTimeout(() => {
        setSimMode('settling');
        setBowlLabel('出目を判定中…');
      }, 780);
      return () => window.clearTimeout(timer);
    }
  }, [state.lastLog]);

  const handleSettled = useCallback(() => {
    setSimMode('idle');
    setBowlLabel(pendingLabelRef.current || '確定！');
  }, []);

  const handleStartShake = () => {
    if (!isMyTurn || simMode !== 'idle') return;
    setSimMode('shaking');
    setBowlLabel('「止める！」で出目を決定');
  };

  const handleStop = () => {
    if (!isMyTurn || simMode !== 'shaking') return;
    awaitingResultRef.current = true;
    onAction({ type: 'roll' });
  };

  return (
    <div className="board-container">
      <div className="status-flags">
        <span className="flag-badge info">
          第 {state.round} / {state.rules.rounds} 局
        </span>
        <span className="flag-badge warn">親: {dealer.name}</span>
        <button
          type="button"
          className="chip-btn"
          onClick={() => setSoundEnabled((v) => !v)}
          aria-label="効果音切替"
        >
          {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          {soundEnabled ? '音ON' : '音OFF'}
        </button>
      </div>

      <div className="chinchiro-bowl-stage">
        <ChinchiroBowl3D
          mode={simMode}
          targetDice={targetDice}
          soundEnabled={soundEnabled}
          onSettled={handleSettled}
        />
        <div className={`bowl-result-banner ${simMode === 'idle' && activeHand ? 'pop' : ''}`}>
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
          {simMode === 'shaking' && isMyTurn ? (
            <button
              type="button"
              className="danger-btn full-width"
              onClick={handleStop}
            >
              <Hand size={18} />
              止める！（出目を決める）
            </button>
          ) : (
            <button
              type="button"
              className="primary-btn full-width"
              disabled={!isMyTurn || simMode !== 'idle'}
              onClick={handleStartShake}
            >
              <Dices size={18} />
              {simMode === 'settling'
                ? '判定中…'
                : simMode === 'shaking'
                ? `${current.name} が振っています…`
                : isMyTurn
                ? `茶碗を振る（残り ${current.rollsLeft} 回）`
                : `${current.name} のターン`}
            </button>
          )}
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
