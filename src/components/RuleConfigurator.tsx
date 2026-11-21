import React from 'react';
import { GAME_REGISTRY } from '../games/registry';
import type { GameId, GameRulesMap } from '../types/game';

interface RuleConfiguratorProps {
  gameId: GameId;
  rules: GameRulesMap[GameId];
  onChange?: (nextRules: GameRulesMap[GameId]) => void;
  readOnly?: boolean;
}

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
        return (
          <div key={field.key} className="rule-item">
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
