import type { GameId } from '../types/game';
import { RULE_GUIDES_PART1 } from './ruleGuidesPart1';
import { RULE_GUIDES_PART2 } from './ruleGuidesPart2';
import type { GameRuleGuideData } from './ruleGuideTypes';

export type { GameRuleGuideData } from './ruleGuideTypes';

export const GAME_RULE_GUIDES: Record<GameId, GameRuleGuideData> = {
  ...RULE_GUIDES_PART1,
  ...RULE_GUIDES_PART2,
};
