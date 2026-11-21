import React, { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { GAME_REGISTRY, type RuleFieldDef } from '../games/registry';
import type { GameId, GameRulesMap } from '../types/game';

interface RuleConfiguratorProps {
  gameId: GameId;
  rules: GameRulesMap[GameId];
  onChange?: (nextRules: GameRulesMap[GameId]) => void;
  readOnly?: boolean;
}

interface NumberRuleControlProps {
  field: RuleFieldDef;
  value: number;
  readOnly: boolean;
  onUpdate: (nextVal: number) => void;
}

const NumberRuleControl: React.FC<NumberRuleControlProps> = ({
  field,
  value,
  readOnly,
  onUpdate,
}) => {
  const [draft, setDraft] = useState<string>(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const min = field.min ?? 0;
  const max = field.max ?? 999999;
  const step = field.step ?? 1;

  // プリセット選択肢に「上限なし」（rounds=0 または passLimit=99）が含まれるか判定
  const unlimitedOpt = field.options?.find((o) =>
    String(o.label).includes('上限なし') || String(o.label).includes('無制限')
  );
  const isUnlimited = unlimitedOpt !== undefined && value === Number(unlimitedOpt.value);

  const clampVal = (n: number) => {
    if (unlimitedOpt && n === Number(unlimitedOpt.value)) return n;
    return Math.max(min, Math.min(max, Math.trunc(n)));
  };

  const commitDraft = (rawStr: string) => {
    const cleaned = rawStr.replace(/[^0-9-]/g, '');
    if (!cleaned || cleaned === '-') {
      setDraft(String(value));
      return;
    }
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) {
      setDraft(String(value));
      return;
    }
    const next = clampVal(parsed);
    setDraft(String(next));
    onUpdate(next);
  };

  const handleStep = (delta: number) => {
    if (readOnly) return;
    if (isUnlimited) {
      // 上限なし状態から±ボタンを押したら最初の通常プリセットまたはminへ戻す
      const firstNormal = field.options?.find((o) => o.value !== unlimitedOpt?.value);
      const base = firstNormal ? Number(firstNormal.value) : Math.max(1, min);
      onUpdate(clampVal(base));
      return;
    }
    const next = clampVal(value + delta);
    onUpdate(next);
  };

  if (readOnly) {
    return (
      <div className="rule-readonly-value">
        {isUnlimited
          ? '上限なし'
          : `${value.toLocaleString()}${field.unit ? ` ${field.unit}` : ''}`}
      </div>
    );
  }

  return (
    <div className="rule-number-box">
      {field.options && field.options.length > 0 && (
        <div className="rule-preset-chips">
          {field.options.map((opt) => {
            const numVal = Number(opt.value);
            const active = value === numVal;
            return (
              <button
                key={String(opt.value)}
                type="button"
                className={`rule-preset-chip ${active ? 'active' : ''}`}
                onClick={() => onUpdate(numVal)}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      <div className="rule-custom-input-row">
        <button
          type="button"
          className="rule-step-btn"
          disabled={!isUnlimited && value <= min}
          onClick={() => handleStep(-step)}
          aria-label="減らす"
        >
          <Minus size={13} />
        </button>

        <div className="rule-num-input-wrap">
          {isUnlimited ? (
            <button
              type="button"
              className="rule-unlimited-badge"
              onClick={() => {
                const firstNormal = field.options?.find((o) => o.value !== unlimitedOpt?.value);
                onUpdate(firstNormal ? Number(firstNormal.value) : Math.max(1, min));
              }}
              title="タップして数値指定に切り替え"
            >
              上限なし（タップで数値入力）
            </button>
          ) : (
            <>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                className="rule-num-input"
                value={draft}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9]/g, '');
                  setDraft(raw);
                  if (raw !== '') {
                    const num = Number(raw);
                    if (Number.isFinite(num) && num >= min && num <= max) {
                      onUpdate(Math.trunc(num));
                    }
                  }
                }}
                onBlur={() => commitDraft(draft)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                aria-label={field.label}
              />
              {field.unit && <span className="rule-num-unit">{field.unit}</span>}
            </>
          )}
        </div>

        <button
          type="button"
          className="rule-step-btn"
          disabled={!isUnlimited && value >= max}
          onClick={() => handleStep(step)}
          aria-label="増やす"
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
};

export const RuleConfigurator: React.FC<RuleConfiguratorProps> = ({
  gameId,
  rules,
  onChange,
  readOnly = false,
}) => {
  const meta = GAME_REGISTRY[gameId];
  const rulesObj = rules as unknown as Record<string, boolean | number | string>;

  const updateField = (key: string, value: boolean | number | string) => {
    if (readOnly || !onChange) return;
    onChange({
      ...rulesObj,
      [key]: value,
    } as unknown as GameRulesMap[GameId]);
  };

  return (
    <div className="rule-list">
      {meta.ruleFields.map((field) => {
        const val = rulesObj[field.key];
        const isNumberType = field.type === 'number';
        return (
          <div key={field.key} className={`rule-item ${isNumberType ? 'rule-item--stacked' : ''}`}>
            <div className="rule-info">
              <div className="rule-label">{field.label}</div>
              <div className="rule-desc">{field.description}</div>
            </div>
            <div className="rule-control">
              {field.type === 'boolean' ? (
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(val)}
                  disabled={readOnly}
                  className={`toggle-btn ${val ? 'on' : 'off'}`}
                  onClick={() => updateField(field.key, !val)}
                >
                  <span className="toggle-thumb" />
                  <span className="toggle-text">{val ? 'ON' : 'OFF'}</span>
                </button>
              ) : field.type === 'number' ? (
                <NumberRuleControl
                  field={field}
                  value={Number(val) || 0}
                  readOnly={readOnly}
                  onUpdate={(nextVal) => updateField(field.key, nextVal)}
                />
              ) : (
                <select
                  className="rule-select"
                  value={String(val)}
                  disabled={readOnly}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const num = Number(raw);
                    updateField(field.key, Number.isNaN(num) ? raw : num);
                  }}
                >
                  {field.options?.map((opt) => (
                    <option key={String(opt.value)} value={String(opt.value)}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
