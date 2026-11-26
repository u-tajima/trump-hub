import React from 'react';
import {
  Anchor,
  Binary,
  Box,
  Brain,
  Circle,
  CircleDot,
  ClipboardList,
  Coins,
  Columns3,
  Compass,
  Crosshair,
  Crown,
  Dices,
  Eye,
  Flag,
  Flame,
  Gem,
  Grid3X3,
  Hash,
  HelpCircle,
  Hexagon,
  Layers,
  LayoutGrid,
  MessageSquare,
  Moon,
  Orbit,
  Shield,
  Spade,
  Swords,
  Target,
  Trophy,
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
  | 'swords'
  | 'shield'
  | 'circle'
  | 'moon'
  | 'dice'
  | 'target'
  | 'layers'
  | 'coins'
  | 'flame'
  | 'orbit'
  | 'layoutGrid'
  | 'anchor'
  | 'binary'
  | 'crosshair'
  | 'trophy'
  | 'hexagon'
  | 'compass'
  | 'flag'
  | 'messageSquare'
  | 'helpCircle'
  | 'box';

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
    case 'swords':
      return <Swords size={size} className={className} />;
    case 'shield':
      return <Shield size={size} className={className} />;
    case 'circle':
      return <Circle size={size} className={className} />;
    case 'moon':
      return <Moon size={size} className={className} />;
    case 'dice':
      return <Dices size={size} className={className} />;
    case 'target':
      return <Target size={size} className={className} />;
    case 'layers':
      return <Layers size={size} className={className} />;
    case 'coins':
      return <Coins size={size} className={className} />;
    case 'flame':
      return <Flame size={size} className={className} />;
    case 'orbit':
      return <Orbit size={size} className={className} />;
    case 'layoutGrid':
      return <LayoutGrid size={size} className={className} />;
    case 'anchor':
      return <Anchor size={size} className={className} />;
    case 'binary':
      return <Binary size={size} className={className} />;
    case 'crosshair':
      return <Crosshair size={size} className={className} />;
    case 'trophy':
      return <Trophy size={size} className={className} />;
    case 'hexagon':
      return <Hexagon size={size} className={className} />;
    case 'compass':
      return <Compass size={size} className={className} />;
    case 'flag':
      return <Flag size={size} className={className} />;
    case 'messageSquare':
      return <MessageSquare size={size} className={className} />;
    case 'helpCircle':
      return <HelpCircle size={size} className={className} />;
    case 'box':
      return <Box size={size} className={className} />;
  }
};
