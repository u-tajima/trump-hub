import React from 'react';
import {
  Brain,
  CircleDot,
  ClipboardList,
  Columns3,
  Crown,
  Dices,
  Eye,
  Gem,
  Grid3X3,
  Hash,
  Spade,
  Target,
  Zap,
} from 'lucide-react';

export type GameIconKey =
  | 'clipboard'
  | 'crown'
  | 'hash'
  | 'zap'
  | 'spade'
  | 'eye'
  | 'brain'
  | 'gem'
  | 'disc'
  | 'grid'
  | 'columns'
  | 'dice'
  | 'target';

interface GameIconProps {
  name: GameIconKey;
  size?: number;
  className?: string;
}

export const GameIcon: React.FC<GameIconProps> = ({ name, size = 18, className }) => {
  switch (name) {
    case 'clipboard':
      return <ClipboardList size={size} className={className} />;
    case 'crown':
      return <Crown size={size} className={className} />;
    case 'hash':
      return <Hash size={size} className={className} />;
    case 'zap':
      return <Zap size={size} className={className} />;
    case 'spade':
      return <Spade size={size} className={className} />;
    case 'eye':
      return <Eye size={size} className={className} />;
    case 'brain':
      return <Brain size={size} className={className} />;
    case 'gem':
      return <Gem size={size} className={className} />;
    case 'disc':
      return <CircleDot size={size} className={className} />;
    case 'grid':
      return <Grid3X3 size={size} className={className} />;
    case 'columns':
      return <Columns3 size={size} className={className} />;
    case 'dice':
      return <Dices size={size} className={className} />;
    case 'target':
      return <Target size={size} className={className} />;
  }
};
