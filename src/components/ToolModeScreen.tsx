import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Dices,
  Hand,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Target,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Dice3D } from './Dice3D';
import {
  type CustomRouletteSlot,
  CustomRouletteTool3D,
  type CustomRouletteTool3DHandle,
} from './tools/CustomRouletteTool3D';
import { DiceTool3D, type DiceTool3DHandle } from './tools/DiceTool3D';
import './BetControl.css';
import './ToolModeScreen.css';

interface ToolModeScreenProps {
  tool: 'dice' | 'roulette';
  onBack: () => void;
}

interface RouletteOptionItem {
  id: string;
  label: string;
  color: string;
  slots: number;
}

// 緑 (#15803d) は「余り（振り直し）」専用のため、選択肢カラーには使わない
const OPTION_COLORS = [
  '#dc2626', // red
  '#2563eb', // blue
  '#d97706', // amber
  '#7c3aed', // violet
  '#db2777', // pink
  '#0891b2', // cyan
  '#ea580c', // orange
  '#4f46e5', // indigo
  '#be123c', // rose
  '#0284c7', // sky
  '#9333ea', // purple
  '#ca8a04', // yellow
];

const REROLL_COLOR = '#15803d';

function distributeEvenly(items: RouletteOptionItem[], totalSlots: number): RouletteOptionItem[] {
  if (items.length === 0) return items;
  const perItem = Math.floor(totalSlots / items.length);
  return items.map((item) => ({ ...item, slots: perItem }));
}

// 各選択肢の枠と余り（緑・振り直し）枠をホイール全体へ均等分散配置する
function buildWheelSlots(items: RouletteOptionItem[], totalSlots: number): CustomRouletteSlot[] {
  const remaining = items.map((item) => ({ item, left: Math.max(0, item.slots) }));
  const assigned: CustomRouletteSlot[] = [];

  let safety = 0;
  while (assigned.length < totalSlots && safety < totalSlots * 2) {
    safety++;
    let added = false;
    for (const entry of remaining) {
      if (entry.left > 0 && assigned.length < totalSlots) {
        assigned.push({
          id: entry.item.id,
          label: entry.item.label.trim() || '選択肢',
          color: entry.item.color,
        });
        entry.left--;
        added = true;
      }
    }
    if (!added) break;
  }

  const rerollCount = Math.max(0, totalSlots - assigned.length);
  if (rerollCount === 0) return assigned;

  // 余り（緑・振り直し）を均等間隔で差し込む
  const result: CustomRouletteSlot[] = [];
  const step = totalSlots / rerollCount;
  const rerollPositions = new Set<number>();
  for (let i = 0; i < rerollCount; i++) {
    rerollPositions.add(Math.min(totalSlots - 1, Math.floor(i * step)));
  }

  let cursor = 0;
  for (let pos = 0; pos < totalSlots; pos++) {
    if (rerollPositions.has(pos) || cursor >= assigned.length) {
      result.push({
        id: '__reroll__',
        label: '振直',
        color: REROLL_COLOR,
        isReroll: true,
      });
    } else {
      result.push(assigned[cursor++]);
    }
  }
  return result;
}

export const ToolModeScreen: React.FC<ToolModeScreenProps> = ({ tool, onBack }) => {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // ===== ダイスツール状態 =====
  const diceRef = useRef<DiceTool3DHandle | null>(null);
  const [diceCount, setDiceCount] = useState<number>(2);
  const [diceMode, setDiceMode] = useState<'idle' | 'shaking' | 'settling'>('idle');
  const [lastDice, setLastDice] = useState<number[] | null>(null);
  const [diceHistory, setDiceHistory] = useState<{ dice: number[]; total: number }[]>([]);

  const handleDiceSettled = useCallback((dice: number[]) => {
    const total = dice.reduce((s, n) => s + n, 0);
    setDiceMode('idle');
    setLastDice(dice);
    setDiceHistory((prev) => [{ dice, total }, ...prev].slice(0, 10));
  }, []);

  const handleChangeDiceCount = (next: number) => {
    if (diceMode !== 'idle') return;
    setDiceCount(next);
    setLastDice(null);
  };

  // ===== カスタムルーレットツール状態 =====
  const rouletteRef = useRef<CustomRouletteTool3DHandle | null>(null);
  const [totalSlots, setTotalSlots] = useState<number>(12);
  const [items, setItems] = useState<RouletteOptionItem[]>(() =>
    distributeEvenly(
      [
        { id: 'opt-1', label: 'A', color: OPTION_COLORS[0], slots: 4 },
        { id: 'opt-2', label: 'B', color: OPTION_COLORS[1], slots: 4 },
        { id: 'opt-3', label: 'C', color: OPTION_COLORS[2], slots: 4 },
      ],
      12
    )
  );
  const [autoEven, setAutoEven] = useState<boolean>(true);
  const [rouletteSpinning, setRouletteSpinning] = useState<boolean>(false);
  const [lastRouletteSlot, setLastRouletteSlot] = useState<CustomRouletteSlot | null>(null);
  const [rouletteHistory, setRouletteHistory] = useState<CustomRouletteSlot[]>([]);

  const usedSlots = items.reduce((s, it) => s + it.slots, 0);
  const rerollSlots = Math.max(0, totalSlots - usedSlots);

  const wheelSlots = useMemo(() => buildWheelSlots(items, totalSlots), [items, totalSlots]);

  const handleChangeTotalSlots = (nextTotal: number) => {
    if (rouletteSpinning) return;
    const clamped = Math.max(Math.max(2, items.length), Math.min(36, nextTotal));
    setTotalSlots(clamped);
    if (autoEven) {
      setItems((prev) => distributeEvenly(prev, clamped));
    } else {
      // 合計枠数を下回った場合は超過分を削る
      setItems((prev) => {
        let sum = prev.reduce((s, it) => s + it.slots, 0);
        if (sum <= clamped) return prev;
        return prev.map((it) => {
          if (sum <= clamped) return it;
          const reduce = Math.min(it.slots, sum - clamped);
          sum -= reduce;
          return { ...it, slots: it.slots - reduce };
        });
      });
    }
  };

  const handleAdjustItemSlots = (id: string, delta: number) => {
    if (rouletteSpinning) return;
    setAutoEven(false);
    setItems((prev) => {
      const currentUsed = prev.reduce((s, it) => s + it.slots, 0);
      return prev.map((it) => {
        if (it.id !== id) return it;
        const maxAllowed = it.slots + Math.max(0, totalSlots - currentUsed);
        const nextVal = Math.max(0, Math.min(maxAllowed, it.slots + delta));
        return { ...it, slots: nextVal };
      });
    });
  };

  const handleResetEven = () => {
    if (rouletteSpinning) return;
    setAutoEven(true);
    setItems((prev) => distributeEvenly(prev, totalSlots));
  };

  const handleAddItem = () => {
    if (rouletteSpinning || items.length >= 12) return;
    const nextIdx = items.length;
    const newItem: RouletteOptionItem = {
      id: `opt-${Date.now()}-${nextIdx}`,
      label: String.fromCharCode(65 + (nextIdx % 26)),
      color: OPTION_COLORS[nextIdx % OPTION_COLORS.length],
      slots: 0,
    };
    const nextItems = [...items, newItem];
    const nextTotal = Math.max(totalSlots, nextItems.length);
    if (nextTotal !== totalSlots) setTotalSlots(nextTotal);
    setItems(autoEven ? distributeEvenly(nextItems, nextTotal) : nextItems);
  };

  const handleRemoveItem = (id: string) => {
    if (rouletteSpinning || items.length <= 2) return;
    const nextItems = items.filter((it) => it.id !== id);
    setItems(autoEven ? distributeEvenly(nextItems, totalSlots) : nextItems);
  };

  const handleRenameItem = (id: string, label: string) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, label } : it)));
  };

  const handleRouletteSettled = useCallback((slot: CustomRouletteSlot) => {
    setRouletteSpinning(false);
    setLastRouletteSlot(slot);
    setRouletteHistory((prev) => [slot, ...prev].slice(0, 10));
  }, []);

  return (
    <div className="screen game-screen">
      <header className="top-bar">
        <button type="button" className="icon-text-btn" onClick={onBack}>
          <ArrowLeft size={16} />
          ツール選択
        </button>
        <div className="top-bar-center">
          <span className="top-bar-title title-with-icon">
            {tool === 'dice' ? <Dices size={16} /> : <Target size={16} />}
            {tool === 'dice' ? '3D物理ダイス' : '3Dカスタムルーレット'}
          </span>
          <span className="top-bar-code">TOOL MODE</span>
        </div>
        <button
          type="button"
          className="icon-text-btn"
          onClick={() => setSoundEnabled((v) => !v)}
          aria-label="効果音切替"
        >
          {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          {soundEnabled ? '音ON' : '音OFF'}
        </button>
      </header>

      <main className="game-main">
        <div className="board-container">
          {tool === 'dice' ? (
            <>
              {/* 3D物理ダイスステージ */}
              <div className="chinchiro-bowl-stage">
                <DiceTool3D
                  ref={diceRef}
                  diceCount={diceCount}
                  soundEnabled={soundEnabled}
                  onSettled={handleDiceSettled}
                />
                <div className={`bowl-result-banner ${diceMode === 'idle' && lastDice ? 'pop' : ''}`}>
                  {diceMode === 'shaking'
                    ? '「止める！」で茶碗を止める'
                    : diceMode === 'settling'
                    ? '自然停止を待っています…'
                    : lastDice
                    ? `出目: [${lastDice.join('・')}]  合計 ${lastDice.reduce((s, n) => s + n, 0)}`
                    : `${diceCount}個のダイスを振ってみよう`}
                </div>
              </div>

              {/* 結果サマリー */}
              {lastDice && (
                <div className="tool-dice-summary">
                  <div className="dice-trio">
                    {lastDice.map((v, i) => (
                      <Dice3D key={i} value={v} size="sm" />
                    ))}
                  </div>
                  <div className="tool-dice-total">
                    合計 {lastDice.reduce((s, n) => s + n, 0)}
                  </div>
                </div>
              )}

              {/* ダイス個数指定 */}
              <section className="card-panel">
                <div className="panel-header-row">
                  <span className="panel-title">ダイスの個数（{diceCount}個）</span>
                </div>
                <div className="tool-dice-count-row mt-8">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`tool-count-btn ${diceCount === n ? 'active' : ''}`}
                      disabled={diceMode !== 'idle'}
                      onClick={() => handleChangeDiceCount(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </section>

              {/* 履歴 */}
              {diceHistory.length > 0 && (
                <section className="card-panel">
                  <div className="panel-header-row">
                    <span className="panel-title">ロール履歴</span>
                    <button
                      type="button"
                      className="chip-btn"
                      onClick={() => setDiceHistory([])}
                    >
                      <RotateCcw size={13} />
                      クリア
                    </button>
                  </div>
                  <div className="tool-history-list mt-8">
                    {diceHistory.map((h, i) => (
                      <div key={i} className="tool-history-item">
                        <span>[{h.dice.join(' - ')}]</span>
                        <strong>合計 {h.total}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="sticky-bottom-bar">
                {diceMode === 'shaking' ? (
                  <button
                    type="button"
                    className="danger-btn full-width"
                    onClick={() => {
                      setDiceMode('settling');
                      diceRef.current?.stopShake();
                    }}
                  >
                    <Hand size={18} />
                    止める！（出目を決める）
                  </button>
                ) : (
                  <button
                    type="button"
                    className="primary-btn full-width"
                    disabled={diceMode !== 'idle'}
                    onClick={() => {
                      setDiceMode('shaking');
                      diceRef.current?.startShake();
                    }}
                  >
                    <Dices size={18} />
                    {diceMode === 'settling'
                      ? '自然停止を待っています…'
                      : `茶碗を振る（${diceCount}個）`}
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* 3D物理カスタムルーレットステージ */}
              <div className="roulette-stage">
                <CustomRouletteTool3D
                  ref={rouletteRef}
                  slots={wheelSlots}
                  soundEnabled={soundEnabled}
                  onSettled={handleRouletteSettled}
                />
                <div
                  className={`roulette-result-banner ${
                    !rouletteSpinning && lastRouletteSlot ? 'pop' : ''
                  }`}
                >
                  {rouletteSpinning ? (
                    <span>回転中… 玉の行方に注目！</span>
                  ) : lastRouletteSlot ? (
                    <>
                      <span
                        className="tool-color-swatch"
                        style={{ background: lastRouletteSlot.color }}
                      />
                      <span>
                        {lastRouletteSlot.isReroll
                          ? '緑：振り直し！（もう一度スピン）'
                          : `当選：${lastRouletteSlot.label}`}
                      </span>
                    </>
                  ) : (
                    <span>枠数や選択肢を設定してスピンしよう</span>
                  )}
                </div>
              </div>

              {/* 総枠数設定 */}
              <section className="card-panel">
                <div className="panel-header-row">
                  <span className="panel-title">ホイール総枠数：{totalSlots} 枠</span>
                  <button
                    type="button"
                    className="chip-btn"
                    disabled={rouletteSpinning}
                    onClick={handleResetEven}
                  >
                    <RotateCcw size={13} />
                    等分に戻す
                  </button>
                </div>

                <div className="tool-slot-presets mt-8">
                  {[6, 12, 18, 24, 36].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`bet-preset-btn ${totalSlots === n ? 'active' : ''}`}
                      disabled={rouletteSpinning || n < items.length}
                      onClick={() => handleChangeTotalSlots(n)}
                    >
                      {n}枠
                    </button>
                  ))}
                </div>

                <div className="bet-slider-row mt-8">
                  <button
                    type="button"
                    className="bet-step-btn"
                    disabled={rouletteSpinning || totalSlots <= Math.max(2, items.length)}
                    onClick={() => handleChangeTotalSlots(totalSlots - 1)}
                    aria-label="総枠数を減らす"
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="range"
                    className="bet-range-slider"
                    min={Math.max(2, items.length)}
                    max={36}
                    step={1}
                    disabled={rouletteSpinning}
                    value={totalSlots}
                    onChange={(e) => handleChangeTotalSlots(Number(e.target.value))}
                  />
                  <button
                    type="button"
                    className="bet-step-btn"
                    disabled={rouletteSpinning || totalSlots >= 36}
                    onClick={() => handleChangeTotalSlots(totalSlots + 1)}
                    aria-label="総枠数を増やす"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </section>

              {/* 選択肢＆割り当て枠数リスト */}
              <section className="card-panel">
                <div className="panel-header-row">
                  <span className="panel-title">
                    選択肢と割り当て枠（{usedSlots}/{totalSlots}）
                  </span>
                  <button
                    type="button"
                    className="chip-btn accent"
                    disabled={rouletteSpinning || items.length >= 12}
                    onClick={handleAddItem}
                  >
                    <Plus size={14} />
                    追加
                  </button>
                </div>

                <div className="tool-roulette-items mt-8">
                  {items.map((it) => {
                    const pct = totalSlots > 0 ? Math.round((it.slots / totalSlots) * 100) : 0;
                    return (
                      <div key={it.id} className="tool-roulette-item-row">
                        <span className="tool-color-swatch" style={{ background: it.color }} />
                        <input
                          type="text"
                          className="tool-item-input"
                          maxLength={14}
                          disabled={rouletteSpinning}
                          value={it.label}
                          onChange={(e) => handleRenameItem(it.id, e.target.value)}
                          placeholder="選択肢名"
                        />
                        <div className="tool-item-slots">
                          <button
                            type="button"
                            className="bet-step-btn"
                            disabled={rouletteSpinning || it.slots <= 0}
                            onClick={() => handleAdjustItemSlots(it.id, -1)}
                            aria-label="枠数を減らす"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="tool-slot-num">{it.slots}枠</span>
                          <button
                            type="button"
                            className="bet-step-btn"
                            disabled={rouletteSpinning || rerollSlots <= 0}
                            onClick={() => handleAdjustItemSlots(it.id, 1)}
                            aria-label="枠数を増やす"
                          >
                            <Plus size={13} />
                          </button>
                          <span className="tool-slot-pct">{pct}%</span>
                        </div>
                        {items.length > 2 && (
                          <button
                            type="button"
                            className="icon-danger-btn"
                            disabled={rouletteSpinning}
                            onClick={() => handleRemoveItem(it.id)}
                            aria-label="選択肢を削除"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  <div className="tool-reroll-row">
                    <span>
                      <span
                        className="tool-color-swatch"
                        style={{
                          background: REROLL_COLOR,
                          display: 'inline-block',
                          verticalAlign: 'middle',
                          marginRight: 6,
                        }}
                      />
                      余り枠：緑（振り直し）
                    </span>
                    <strong>
                      {rerollSlots}枠 ({Math.round((rerollSlots / totalSlots) * 100)}%)
                    </strong>
                  </div>
                </div>
              </section>

              {/* ルーレット履歴 */}
              {rouletteHistory.length > 0 && (
                <section className="card-panel">
                  <div className="panel-header-row">
                    <span className="panel-title">スピン履歴</span>
                    <button
                      type="button"
                      className="chip-btn"
                      onClick={() => setRouletteHistory([])}
                    >
                      <RotateCcw size={13} />
                      クリア
                    </button>
                  </div>
                  <div className="tool-history-list mt-8">
                    {rouletteHistory.map((h, i) => (
                      <div key={i} className="tool-history-item">
                        <span className="title-with-icon">
                          <span className="tool-color-swatch" style={{ background: h.color }} />
                          {h.isReroll ? '振り直し（緑）' : h.label}
                        </span>
                        <span className="text-muted-sm">#{rouletteHistory.length - i}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="sticky-bottom-bar">
                <button
                  type="button"
                  className="primary-btn full-width"
                  disabled={rouletteSpinning || wheelSlots.length < 2}
                  onClick={() => {
                    setRouletteSpinning(true);
                    setLastRouletteSlot(null);
                    rouletteRef.current?.startSpin();
                  }}
                >
                  <Play size={18} />
                  {rouletteSpinning ? '玉が転がっています…' : '玉を投げる！（スピン）'}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
};
