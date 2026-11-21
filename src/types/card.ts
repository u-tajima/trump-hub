export type Suit = 'spade' | 'heart' | 'diamond' | 'club' | 'joker';

export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 0; // 0 = Joker

export interface Card {
  id: string; // unique id e.g. 'spade-1', 'joker-1'
  suit: Suit;
  rank: Rank;
}

export const SUIT_SYMBOLS: Record<Suit, string> = {
  spade: '♠',
  heart: '♥',
  diamond: '♦',
  club: '♣',
  joker: '★',
};

export const SUIT_COLORS: Record<Suit, 'black' | 'red' | 'joker'> = {
  spade: 'black',
  club: 'black',
  heart: 'red',
  diamond: 'red',
  joker: 'joker',
};

export function formatRank(rank: Rank): string {
  switch (rank) {
    case 0:
      return 'JOKER';
    case 1:
      return 'A';
    case 11:
      return 'J';
    case 12:
      return 'Q';
    case 13:
      return 'K';
    default:
      return String(rank);
  }
}

export function formatCardShort(card: Card): string {
  if (card.suit === 'joker') return 'JK';
  return `${SUIT_SYMBOLS[card.suit]}${formatRank(card.rank)}`;
}
