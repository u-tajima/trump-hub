import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Coins, Dices, Hand, Minus, Plus, Trophy, Volume2, VolumeX } from 'lucide-react';
import { type ChinchiroClientState, getChinchiroMaxStake } from '../../games/chinchiro';
import { ChinchiroBowl3D, type ChinchiroBowl3DHandle } from '../ChinchiroBowl3D';
import { Dice3D } from '../Dice3D';
import '../BetControl.css';

interface ChinchiroBoardProps {
  state: ChinchiroClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

type UiMode = 'idle' | 'shaking' | 'settling' | 'replaying';

export const ChinchiroBoard: React.FC<ChinchiroBoardProps> = ({ state, onAction }) => {
  const bowlRef = useRef<ChinchiroBowl3DHandle | null>(null);
  const [uiMode, setUiMode] = useState<UiMode>('idle');
  const [bowlLabel, setBowlLabel] = useState<string>('茶碗を振ってスタート');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  const prevSeqRef = useRef<number>(state.rollSeq);
  const ignoreNextSeqRef = useRef<number | null>(null);
  const pendingLabelRef = useRef<string>('');
  const rollSeqRef = useRef<number>(state.rollSeq);
  rollSeqRef.current = state.rollSeq;

  const current = state.players[state.turnIndex];
  const isMyTurn = state.phase === 'playing' && current.id === state.myId;
  const dealer = state.players[state.dealerIndex];
  const meIdx = state.players.findIndex((p) => p.id === state.myId);
  const me = meIdx >= 0 ? state.players[meIdx] : state.players[0];
  const isMeDealer = meIdx === state.dealerIndex;
  const canAdjustStake =
    state.phase === 'playing' &&
    !isMeDealer &&
    me.rollsLeft === 3 &&
    !me.doneThisRound &&
    uiMode === 'idle';
  const maxStake = getChinchiroMaxStake(me.points);

  const [draftStake, setDraftStake] = useState<number>(me.stake);
  useEffect(() => {
    setDraftStake(me.stake);
  }, [me.stake, state.round]);

  const commitStake = (amount: number) => {
    const clamped = Math.max(5, Math.min(maxStake, Math.round(amount / 5) * 5));
    setDraftStake(clamped);
    onAction({ type: 'setStake', payload: { amount: clamped } });
  };

  useEffect(() => {
    if (state.rollSeq === prevSeqRef.current) return;
    prevSeqRef.current = state.rollSeq;

    const hand = state.lastRolledHand;
    if (!hand) return;

    const roller = state.players.find((p) => p.id === state.lastRolledPlayerId);
    const resultLabel = roller ? `${roller.name}: ${hand.label}` : hand.label;

    // 自分の物理ロールで確定した直後の反映なら、すでに茶碗内で自然静止しているため再再生しない
    if (ignoreNextSeqRef.current === state.rollSeq) {
      ignoreNextSeqRef.current = null;
      setUiMode('idle');
      setBowlLabel(resultLabel);
      return;
    }

    // 相手・CPUのロールは cannon-es 事前計算リマップ再生で自然にその出目で静止させる
    pendingLabelRef.current = resultLabel;
    setUiMode('replaying');
    setBowlLabel(roller ? `${roller.name} が振っています…` : '茶碗を振っています…');
    bowlRef.current?.playTargetRoll(hand.dice);
  }, [state.rollSeq, state.lastRolledHand, state.lastRolledPlayerId, state.players]);

  const handleInteractiveSettled = useCallback(
    (dice: [number, number, number]) => {
      ignoreNextSeqRef.current = rollSeqRef.current + 1;
      setUiMode('idle');
      setBowlLabel(`[${dice.join('-')}] 判定中…`);
      onAction({ type: 'roll', payload: { dice } });
    },
    [onAction]
  );

  const handleReplaySettled = useCallback(() => {
    setUiMode('idle');
    setBowlLabel(pendingLabelRef.current || '確定！');
  }, []);

  const handleStartShake = () => {
    if (!isMyTurn || uiMode !== 'idle') return;
    setUiMode('shaking');
    setBowlLabel('「止める！」で茶碗を止める');
    bowlRef.current?.startInteractiveShake();
  };

  const handleStop = () => {
    if (!isMyTurn || uiMode !== 'shaking') return;
    setUiMode('settling');
    setBowlLabel('自然停止を待っています…');
    bowlRef.current?.stopInteractiveShake();
  };

  const stakePresets = [10, 20, 30, 50].filter((v) => v < maxStake);

  return (
    <div className="board-container">
      <div className="status-flags">
        <span className="flag-badge info">
          第 {state.round} / {state.rules.rounds > 0 ? state.rules.rounds : '∞'} 局
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

      {/* cannon-es 剛体物理 + Three.js 斜め俯瞰 3D茶碗ステージ */}
      <div className="chinchiro-bowl-stage">
        <ChinchiroBowl3D
          ref={bowlRef}
          soundEnabled={soundEnabled}
          onInteractiveSettled={handleInteractiveSettled}
          onReplaySettled={handleReplaySettled}
        />
        <div className={`bowl-result-banner ${uiMode === 'idle' && state.lastRolledHand ? 'pop' : ''}`}>
          {bowlLabel}
        </div>
      </div>

      {/* 子の張り額（賭け点）調整パネル：振る前なら親の出目を見て調整可能 */}
      {canAdjustStake && (
        <div className="chinchiro-stake-panel">
          <div className="chinchiro-stake-header">
            <span>
              <Coins size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              この局の張り額（賭け点）
            </span>
            <span className="chinchiro-stake-value">{draftStake} 点</span>
          </div>
          <div className="chinchiro-stake-presets">
            {stakePresets.map((amt) => (
              <button
                key={amt}
                type="button"
                className={`bet-preset-btn ${draftStake === amt ? 'active' : ''}`}
                onClick={() => commitStake(amt)}
              >
                {amt}
              </button>
            ))}
            <button
              type="button"
              className={`bet-preset-btn allin ${draftStake >= maxStake ? 'active' : ''}`}
              style={
                stakePresets.length < 4
                  ? { gridColumn: `span ${5 - stakePresets.length}` }
                  : undefined
              }
              onClick={() => commitStake(maxStake)}
            >
              全ツッパ
            </button>
          </div>
          <div className="bet-slider-row">
            <button
              type="button"
              className="bet-step-btn"
              disabled={draftStake <= 5}
              onClick={() => commitStake(draftStake - 5)}
              aria-label="張り額を減らす"
            >
              <Minus size={14} />
            </button>
            <input
              type="range"
              className="bet-range-slider"
              min={5}
              max={maxStake}
              step={5}
              value={Math.min(maxStake, Math.max(5, draftStake))}
              onChange={(e) => setDraftStake(Number(e.target.value))}
              onPointerUp={() => commitStake(draftStake)}
              onTouchEnd={() => commitStake(draftStake)}
            />
            <button
              type="button"
              className="bet-step-btn"
              disabled={draftStake >= maxStake}
              onClick={() => commitStake(draftStake + 5)}
              aria-label="張り額を増やす"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="chinchiro-players">
        {state.players.map((p, idx) => {
          const active = state.phase === 'playing' && idx === state.turnIndex;
          const isDealer = idx === state.dealerIndex;
          return (
            <div key={p.id} className={`chinchiro-row ${active ? 'active' : ''} ${p.id === state.myId ? 'me' : ''}`}>
              <div className="chinchiro-row-top">
                <div>
                  <strong>{p.name}</strong>
                  {isDealer ? (
                    <span className="badge host ml-8">親</span>
                  ) : (
                    <span className="stake-tag-badge">張り {p.stake}点</span>
                  )}
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
          {uiMode === 'shaking' && isMyTurn ? (
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
              disabled={!isMyTurn || uiMode !== 'idle'}
              onClick={handleStartShake}
            >
              <Dices size={18} />
              {uiMode === 'settling'
                ? '自然停止を待っています…'
                : uiMode === 'replaying'
                ? 'ダイスが転がっています…'
                : isMyTurn
                ? isMeDealer
                  ? `親として茶碗を振る（残り ${current.rollsLeft} 回）`
                  : `${me.stake}点張って茶碗を振る（残り ${current.rollsLeft} 回）`
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
