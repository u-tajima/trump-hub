import React from 'react';
import { CheckCircle2, Info, ListOrdered, Trophy } from 'lucide-react';
import { GAME_RULE_GUIDES } from '../games/ruleGuides';
import type { GameId } from '../types/game';
import './GameRuleGuide.css';

interface GameRuleGuideProps {
  gameId: GameId;
}

export const GameRuleGuide: React.FC<GameRuleGuideProps> = ({ gameId }) => {
  const guide = GAME_RULE_GUIDES[gameId];
  if (!guide) return null;

  return (
    <div className="rule-guide">
      <div className="rule-guide-goal">
        <div className="rule-guide-heading goal">
          <Trophy size={14} />
          <span>勝利条件・目的</span>
        </div>
        <p className="rule-guide-goal-text">{guide.goal}</p>
      </div>

      <div className="rule-guide-section">
        <div className="rule-guide-heading">
          <ListOrdered size={14} />
          <span>基本的な流れ</span>
        </div>
        <ol className="rule-guide-steps">
          {guide.flow.map((step, idx) => (
            <li key={idx} className="rule-guide-step-item">
              <span className="rule-guide-step-num">{idx + 1}</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="rule-guide-section">
        <div className="rule-guide-heading">
          <Info size={14} />
          <span>重要ルール・ポイント</span>
        </div>
        <ul className="rule-guide-points">
          {guide.points.map((pt, idx) => (
            <li key={idx} className="rule-guide-point-item">
              <CheckCircle2 size={13} className="rule-guide-point-icon" />
              <span>{pt}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
