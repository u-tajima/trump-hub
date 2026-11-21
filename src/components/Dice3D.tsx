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

function renderPips(value: number) {
  const pips = PIP_MAP[value] ?? [4];
  return Array.from({ length: 9 }, (_, i) => {
    const active = pips.includes(i);
    const isOne = value === 1 && active;
    return (
      <span
        key={i}
        className={`dice-pip ${active ? 'active' : ''} ${isOne ? 'red-pip' : ''}`}
      />
    );
  });
}

export const Dice3D: React.FC<Dice3DProps> = ({ value, rolling = false, size = 'md' }) => {
  return (
    <div
      className={`dice-cube dice-cube--${size} ${rolling ? 'dice-cube--rolling' : ''}`}
      aria-label={`サイコロ ${value}`}
    >
      {renderPips(value)}
    </div>
  );
};

export const FACE_TARGET_ROTATION: Record<number, { rx: number; ry: number; rz: number }> = {
  1: { rx: 0, ry: 0, rz: 0 },
  2: { rx: -90, ry: 0, rz: 0 },
  3: { rx: 0, ry: -90, rz: 0 },
  4: { rx: 0, ry: 90, rz: 0 },
  5: { rx: 90, ry: 0, rz: 0 },
  6: { rx: 180, ry: 0, rz: 0 },
};

interface DiceCube3DProps {
  rx: number;
  ry: number;
  rz: number;
  x: number;
  y: number;
  z: number;
}

export const DiceCube3D: React.FC<DiceCube3DProps> = ({ rx, ry, rz, x, y, z }) => {
  const scale = 1 + Math.max(0, z) * 0.008;
  const shadowScale = Math.max(0.55, 1 - z * 0.01);

  return (
    <div
      className="dice3d-wrapper"
      style={{
        transform: `translate3d(${x}px, ${y}px, 0)`,
      }}
    >
      <div
        className="dice3d-shadow"
        style={{
          transform: `scale(${shadowScale})`,
          opacity: Math.max(0.2, 0.55 - z * 0.008),
        }}
      />
      <div
        className="dice3d-cube"
        style={{
          transform: `scale(${scale}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`,
        }}
      >
        <div className="dice3d-face front">{renderPips(1)}</div>
        <div className="dice3d-face back">{renderPips(6)}</div>
        <div className="dice3d-face right">{renderPips(3)}</div>
        <div className="dice3d-face left">{renderPips(4)}</div>
        <div className="dice3d-face top">{renderPips(2)}</div>
        <div className="dice3d-face bottom">{renderPips(5)}</div>
      </div>
    </div>
  );
};
