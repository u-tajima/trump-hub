import React from 'react';

interface Dice3DProps {
  value: number;
  rolling?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const PIP_MAP: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export const Dice3D: React.FC<Dice3DProps> = ({ value, rolling = false, size = 'md' }) => {
  const pips = PIP_MAP[value] ?? [4];

  return (
    <div
      className={`dice-cube dice-cube--${size} ${rolling ? 'dice-cube--rolling' : ''}`}
      aria-label={`サイコロ ${value}`}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const active = pips.includes(i);
        const isOne = value === 1 && active;
        return (
          <span
            key={i}
            className={`dice-pip ${active ? 'active' : ''} ${isOne ? 'red-pip' : ''}`}
          />
        );
      })}
    </div>
  );
};
