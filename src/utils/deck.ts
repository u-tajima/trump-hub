import type { Card, Rank, Suit } from '../types/card';

const STANDARD_SUITS: Suit[] = ['spade', 'heart', 'diamond', 'club'];
const STANDARD_RANKS: Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export function createDeck(jokerCount = 0): Card[] {
  const deck: Card[] = [];
  for (const suit of STANDARD_SUITS) {
    for (const rank of STANDARD_RANKS) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
      });
    }
  }
  for (let i = 1; i <= jokerCount; i++) {
    deck.push({
      id: `joker-${i}`,
      suit: 'joker',
      rank: 0,
    });
  }
  return deck;
}

export function shuffle<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function dealCards(deck: Card[], playerCount: number): Card[][] {
  const hands: Card[][] = Array.from({ length: playerCount }, () => []);
  deck.forEach((card, idx) => {
    hands[idx % playerCount].push(card);
  });
  return hands;
}

const SUIT_ORDER: Record<Suit, number> = {
  spade: 0,
  heart: 1,
  diamond: 2,
  club: 3,
  joker: 4,
};

export function sortCardsByRank(cards: Card[], daifugoOrder = false): Card[] {
  return [...cards].sort((a, b) => {
    const ra = daifugoOrder ? daifugoStrength(a.rank) : a.rank === 1 ? 14 : a.rank;
    const rb = daifugoOrder ? daifugoStrength(b.rank) : b.rank === 1 ? 14 : b.rank;
    if (a.suit === 'joker' && b.suit !== 'joker') return 1;
    if (b.suit === 'joker' && a.suit !== 'joker') return -1;
    if (ra !== rb) return ra - rb;
    return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
  });
}

export function daifugoStrength(rank: Rank): number {
  if (rank === 0) return 99; // Joker
  if (rank === 1) return 14; // Ace
  if (rank === 2) return 15; // 2 is strongest normal card
  return rank; // 3..13
}
