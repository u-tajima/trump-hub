import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  Play,
  RotateCcw,
  Trophy,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  formatBetLabel,
  getRouletteColor,
  type RouletteBetKind,
  type RouletteClientState,
} from '../../games/roulette';
import { RouletteWheel3D, type RouletteWheel3DHandle } from '../RouletteWheel3D';

interface RouletteBoardProps {
  state: RouletteClientState;
  onAction: (action: { type: string; payload?: unknown }) => void;
}

type UiSpinMode = 'idle' | 'spinning' | 'replaying';

const OUTSIDE_BETS: { kind: RouletteBetKind; label: string; mult: string; tone?: 'red' | 'black' }[] = [
  { kind: 'red', label: '赤', mult: '2倍', tone: 'red' },
  { kind: 'black', label: '黒', mult: '2倍', tone: 'black' },
  { kind: 'even', label: '偶数', mult: '2倍' },
  { kind: 'odd', label: '奇数', mult: '2倍' },
  { kind: 'low', label: '1-18', mult: '2倍' },
  { kind: 'high', label: '19-36', mult: '2倍' },
  { kind: 'dozen1', label: '1-12', mult: '3倍' },
  { kind: 'dozen2', label: '13-24', mult: '3倍' },
  { kind: 'dozen3', label: '25-36', mult: '3倍' },
];

export const RouletteBoard: React.FC<RouletteBoardProps> = ({ state, onAction }) => {
  const wheelRef = useRef<RouletteWheel3DHandle | null>(null);
  const [uiSpinMode, setUiSpinMode] = useState<UiSpinMode>('idle');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [chipUnit, setChipUnit] = useState<number>(state.rules.minBet);
  const [showNumbers, setShowNumbers] = useState<boolean>(false);
  const [bannerText, setBannerText] = useState<string>('チップを賭けてスピンしよう');
  const [bannerNumber, setBannerNumber] = useState<number | null>(state.lastNumber);

  const prevSeqRef = useRef<number>(state.spinSeq);
  const ignoreNextSeqRef = useRef<number | null>(null);
  const spinSeqRef = useRef<number>(state.spinSeq);
  spinSeqRef.current = state.spinSeq;
  const pendingNumberRef = useRef<number | null>(null);

  const me = state.players.find((p) => p.id === state.myId) ?? state.players[0];
  const spinner = state.players.find((p) => p.id === state.spinnerPlayerId) ?? state.players[0];
  const isSpinner = state.spinnerPlayerId === state.myId;
  const chipOptions = useMemo(() => {
    const base = state.rules.minBet;
    return [base, base * 5, base * 10];
  }, [state.rules.minBet]);

  // 他プレイヤーのスピン結果を受信したら物理リプレイを再生（自分の物理スピン直後はスキップ）
  useEffect(() => {
    if (state.spinSeq === prevSeqRef.current) return;
    prevSeqRef.current = state.spinSeq;

    const num = state.lastNumber;
    if (num === null) return;

    const color = getRouletteColor(num);
    const colorJa = color === 'green' ? '緑' : color === 'red' ? '赤' : '黒';

    if (ignoreNextSeqRef.current === state.spinSeq) {
      ignoreNextSeqRef.current = null;
      setUiSpinMode('idle');
      setBannerNumber(num);
      setBannerText(`${num} (${colorJa})`);
      return;
    }

    pendingNumberRef.current = num;
    setUiSpinMode('replaying');
    setBannerNumber(null);
    setBannerText(`${spinner.name} が玉を投げました…`);
    wheelRef.current?.playTargetSpin(num);
  }, [state.spinSeq, state.lastNumber, spinner.name]);

  // ラウンド切替時にバナーを戻す
  useEffect(() => {
    if (state.subPhase === 'betting' && uiSpinMode === 'idle') {
      setBannerNumber(null);
      setBannerText(`第${state.round}ラウンド：チップを賭けてください`);
    } else if (state.subPhase === 'readyToSpin' && uiSpinMode === 'idle') {
      setBannerNumber(null);
      setBannerText(
        isSpinner ? '「玉を投げる！」でルーレット開始' : `${spinner.name} のスピンを待っています…`
      );
    }
  }, [state.subPhase, state.round, isSpinner, spinner.name, uiSpinMode]);

  const handleInteractiveSettled = useCallback(
    (winningNumber: number) => {
      ignoreNextSeqRef.current = spinSeqRef.current + 1;
      const color = getRouletteColor(winningNumber);
      const colorJa = color === 'green' ? '緑' : color === 'red' ? '赤' : '黒';
      setUiSpinMode('idle');
      setBannerNumber(winningNumber);
      setBannerText(`${winningNumber} (${colorJa})`);
      onAction({ type: 'resolveSpin', payload: { number: winningNumber } });
    },
    [onAction]
  );

  const handleReplaySettled = useCallback(() => {
    const num = pendingNumberRef.current;
    setUiSpinMode('idle');
    if (num !== null) {
      const color = getRouletteColor(num);
      const colorJa = color === 'green' ? '緑' : color === 'red' ? '赤' : '黒';
      setBannerNumber(num);
      setBannerText(`${num} (${colorJa})`);
    }
  }, []);

  const handleLaunchSpin = () => {
    if (state.subPhase !== 'readyToSpin' || !isSpinner || uiSpinMode !== 'idle') return;
    setUiSpinMode('spinning');
    setBannerNumber(null);
    setBannerText('回転中… 玉の行方に注目！');
    wheelRef.current?.startInteractiveSpin();
  };

  const getMyBetAmount = (kind: RouletteBetKind, value?: number): number => {
    const found = me.bets.find((b) => b.kind === kind && (kind !== 'straight' || b.value === value));
    return found?.amount ?? 0;
  };

  const totalMyBet = me.bets.reduce((sum, b) => sum + b.amount, 0);
  const canBet = state.phase === 'playing' && state.subPhase === 'betting' && !me.confirmed;

  return (
    <div className="board-container">
      <div className="status-flags">
        <span className="flag-badge info">
          第 {state.round} / {state.rules.rounds} ラウンド
        </span>
        <span className="flag-badge warn">
          <Coins size={13} /> {me.chips}
        </span>
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

      {/* cannon-es 剛体物理 + Three.js 斜め俯瞰 3Dルーレットステージ */}
      <div className="roulette-stage">
        <RouletteWheel3D
          ref={wheelRef}
          soundEnabled={soundEnabled}
          onInteractiveSettled={handleInteractiveSettled}
          onReplaySettled={handleReplaySettled}
        />
        <div className={`roulette-result-banner ${bannerNumber !== null ? 'pop' : ''}`}>
          {bannerNumber !== null && (
            <span className={`roulette-dot ${getRouletteColor(bannerNumber)}`} />
          )}
          <span>{bannerText}</span>
        </div>
      </div>

      {/* 出目履歴 */}
      {state.history.length > 0 && (
        <div className="roulette-history">
          <span className="roulette-history-label">履歴</span>
          <div className="roulette-history-pills">
            {state.history.map((num, idx) => (
              <span
                key={`${num}-${idx}`}
                className={`roulette-num-pill ${getRouletteColor(num)} ${idx === 0 ? 'latest' : ''}`}
              >
                {num}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ベッティングボード（ベット受付中） */}
      {state.phase === 'playing' && state.subPhase === 'betting' && (
        <section className="card-panel roulette-bet-panel">
          <div className="panel-header-row">
            <span className="panel-title">ベット選択（合計: {totalMyBet}）</span>
            <div className="roulette-chip-selector">
              {chipOptions.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`roulette-chip-btn ${chipUnit === amt ? 'active' : ''}`}
                  onClick={() => setChipUnit(amt)}
                  disabled={!canBet}
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>

          <div className="roulette-outside-grid">
            {OUTSIDE_BETS.map((opt) => {
              const placed = getMyBetAmount(opt.kind);
              return (
                <button
                  key={opt.kind}
                  type="button"
                  className={`roulette-bet-cell ${opt.tone ?? ''} ${placed > 0 ? 'has-bet' : ''}`}
                  disabled={!canBet || me.chips < chipUnit}
                  onClick={() =>
                    onAction({
                      type: 'placeBet',
                      payload: { kind: opt.kind, amount: chipUnit },
                    })
                  }
                >
                  <span className="bet-cell-label">{opt.label}</span>
                  <span className="bet-cell-mult">{opt.mult}</span>
                  {placed > 0 && <span className="bet-cell-chip">{placed}</span>}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="secondary-btn full-width mt-8"
            onClick={() => setShowNumbers((v) => !v)}
          >
            {showNumbers ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            {showNumbers ? '一点賭け（0〜36・36倍）を閉じる' : '一点賭け（0〜36・36倍）を開く'}
          </button>

          {showNumbers && (
            <div className="roulette-straight-wrap">
              <button
                type="button"
                className={`roulette-num-btn green full-span ${
                  getMyBetAmount('straight', 0) > 0 ? 'has-bet' : ''
                }`}
                disabled={!canBet || me.chips < chipUnit}
                onClick={() =>
                  onAction({
                    type: 'placeBet',
                    payload: { kind: 'straight', value: 0, amount: chipUnit },
                  })
                }
              >
                <span>0</span>
                {getMyBetAmount('straight', 0) > 0 && (
                  <span className="bet-cell-chip">{getMyBetAmount('straight', 0)}</span>
                )}
              </button>
              <div className="roulette-numbers-grid">
                {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
                  const placed = getMyBetAmount('straight', n);
                  return (
                    <button
                      key={n}
                      type="button"
                      className={`roulette-num-btn ${getRouletteColor(n)} ${
                        placed > 0 ? 'has-bet' : ''
                      }`}
                      disabled={!canBet || me.chips < chipUnit}
                      onClick={() =>
                        onAction({
                          type: 'placeBet',
                          payload: { kind: 'straight', value: n, amount: chipUnit },
                        })
                      }
                    >
                      <span>{n}</span>
                      {placed > 0 && <span className="bet-cell-chip">{placed}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* プレイヤー一覧＆配当結果 */}
      <div className="chinchiro-players">
        {state.players.map((p) => {
          const totalBet = p.bets.reduce((s, b) => s + b.amount, 0);
          return (
            <div key={p.id} className={`chinchiro-row ${p.id === state.myId ? 'me' : ''}`}>
              <div className="chinchiro-row-top">
                <div>
                  <strong>{p.name}</strong>
                  {p.id === state.spinnerPlayerId && <span className="badge host ml-8">投球</span>}
                  {state.subPhase === 'betting' && p.confirmed && (
                    <span className="badge me ml-8">確定済</span>
                  )}
                </div>
                <div className="chinchiro-points">
                  {p.chips}
                  {state.subPhase === 'result' && uiSpinMode === 'idle' && p.lastNet !== 0 && (
                    <span className={p.lastNet > 0 ? 'delta-plus' : 'delta-minus'}>
                      {' '}
                      ({p.lastNet > 0 ? `+${p.lastNet}` : p.lastNet})
                    </span>
                  )}
                </div>
              </div>
              <div className="chinchiro-row-hand">
                {p.bets.length > 0 ? (
                  <span className="text-muted-sm">
                    賭け({totalBet}):{' '}
                    {p.bets.map((b) => `${formatBetLabel(b)}:${b.amount}`).join(' / ')}
                  </span>
                ) : (
                  <span className="text-muted-sm">ベットなし</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 下部固定アクションバー */}
      {state.phase === 'playing' ? (
        <div className="sticky-bottom-bar">
          {state.subPhase === 'betting' && (
            <div className="roulette-action-row">
              <button
                type="button"
                className="secondary-btn"
                disabled={!canBet || me.bets.length === 0}
                onClick={() => onAction({ type: 'clearBets' })}
              >
                <RotateCcw size={16} />
                クリア
              </button>
              <button
                type="button"
                className="primary-btn flex-1"
                disabled={!canBet}
                onClick={() => onAction({ type: 'confirmBets' })}
              >
                <Check size={18} />
                {me.confirmed ? '他プレイヤーの確定待ち…' : 'ベット確定'}
              </button>
            </div>
          )}

          {state.subPhase === 'readyToSpin' && (
            <button
              type="button"
              className="primary-btn full-width"
              disabled={!isSpinner || uiSpinMode !== 'idle'}
              onClick={handleLaunchSpin}
            >
              <Play size={18} />
              {uiSpinMode === 'spinning'
                ? '玉が転がっています…'
                : isSpinner
                ? '玉を投げる！（スピン）'
                : `${spinner.name} が玉を投げます…`}
            </button>
          )}

          {state.subPhase === 'result' && (
            <button
              type="button"
              className="primary-btn full-width"
              disabled={uiSpinMode !== 'idle'}
              onClick={() => onAction({ type: 'nextRound' })}
            >
              <Play size={18} />
              {uiSpinMode !== 'idle'
                ? '結果判定中…'
                : state.round >= state.rules.rounds
                ? '最終ランキングを見る'
                : `第 ${state.round + 1} ラウンドへ`}
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
              .sort((a, b) => b.chips - a.chips)
              .map((p, idx) => (
                <li key={p.id}>
                  <span>
                    {idx + 1}位 ({p.chips}チップ)
                  </span>
                  <strong>{p.name}</strong>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
};
