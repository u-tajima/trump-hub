import React from 'react';
import { Sparkles } from 'lucide-react';
import { type Card, SUIT_COLORS, SUIT_SYMBOLS, formatRank } from '../types/card';

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  highlight?: boolean;
  animateIn?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  badge?: string;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  faceDown = false,
  selected = false,
  disabled = false,
  highlight = false,
  animateIn = false,
  size = 'md',
  onClick,
  badge,
}) => {
  const classes = [
    'trump-card',
    `trump-card--${size}`,
    faceDown || !card ? 'trump-card--back' : `trump-card--${SUIT_COLORS[card.suit]}`,
    selected ? 'trump-card--selected' : '',
    disabled ? 'trump-card--disabled' : '',
    highlight ? 'trump-card--highlight' : '',
    animateIn ? 'trump-card--enter' : '',
    onClick && !disabled ? 'trump-card--clickable' : '',
  ]
    .filter(Boolean)
    .join(' ');

  if (faceDown || !card) {
    return (
      <button
        type="button"
        className={classes}
        onClick={!disabled ? onClick : undefined}
        disabled={disabled && !onClick}
        aria-label="裏向きのカード"
      >
        <div className="trump-card-back-pattern" />
      </button>
    );
  }

  const symbol = SUIT_SYMBOLS[card.suit];
  const rankText = card.suit === 'joker' ? 'JK' : formatRank(card.rank);

  return (
    <button
      type="button"
      className={classes}
      onClick={!disabled ? onClick : undefined}
      disabled={disabled && !onClick}
      aria-label={`${symbol}${rankText}`}
    >
      {badge && <span className="trump-card-badge">{badge}</span>}
      <div className="trump-card-corner top">
        <span className="trump-card-rank">{rankText}</span>
        <span className="trump-card-suit">{symbol}</span>
      </div>
      <div className="trump-card-center">
        {card.suit === 'joker' ? <Sparkles size={18} /> : symbol}
      </div>
      <div className="trump-card-corner bottom">
        <span className="trump-card-rank">{rankText}</span>
        <span className="trump-card-suit">{symbol}</span>
      </div>
    </button>
  );
};
