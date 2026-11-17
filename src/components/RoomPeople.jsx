// 면접실 그림에 쓰는 사람 모양(면접위원·지원자). 충남대 집단면접실과 개별면접실이 함께 쓴다.
// ── 사람 그림 ───────────────────────────────────────────────
export const PEOPLE = {
  j1: { skin: '#f1c9a5', hair: '#2a211c', style: 'short', suit: '#2f3e52', tie: '#8a2b3a', glasses: true },
  j2: { skin: '#f3cfb0', hair: '#3a2a22', style: 'long', suit: '#4a3d52', tie: null, glasses: true },
  j3: { skin: '#e8b98f', hair: '#1f1a17', style: 'side', suit: '#2e4a44', tie: '#6b5a2a', glasses: false },
  1: { skin: '#f1c9a5', hair: '#1f1a17', style: 'short', suit: '#33445e', tie: '#9a4a3a', glasses: false },
  2: { skin: '#f3cfb0', hair: '#3b2a20', style: 'long', suit: '#2f5a55', tie: null, glasses: false },
  3: { skin: '#d9a77c', hair: '#2a1f18', style: 'side', suit: '#3d3d56', tie: '#5c6b8a', glasses: false },
  4: { skin: '#f0c4a0', hair: '#4a3324', style: 'bob', suit: '#3a4256', tie: null, glasses: false },
  5: { skin: '#e9bb93', hair: '#2b2622', style: 'short', suit: '#4a4436', tie: '#8a2b3a', glasses: true },
};
export function Person({ x, y, p, speaking }) {
  const h = p.hair;
  return (
    <g className={speaking ? 'speaking' : ''}>
      <rect x={x - 40} y={y - 12} width={80} height={96} rx={16} className="cr-chair" />
      {p.style === 'long' && <path d={`M${x - 26} ${y - 4} Q${x - 28} ${y - 33} ${x} ${y - 32} Q${x + 28} ${y - 33} ${x + 26} ${y - 4} L${x + 27} ${y + 34} Q${x + 18} ${y + 40} ${x + 13} ${y + 30} L${x - 13} ${y + 30} Q${x - 18} ${y + 40} ${x - 27} ${y + 34} Z`} fill={h} />}
      {p.style === 'bob' && <path d={`M${x - 26} ${y - 4} Q${x - 28} ${y - 33} ${x} ${y - 32} Q${x + 28} ${y - 33} ${x + 26} ${y - 4} L${x + 26} ${y + 18} Q${x + 20} ${y + 22} ${x + 16} ${y + 16} L${x - 16} ${y + 16} Q${x - 20} ${y + 22} ${x - 26} ${y + 18} Z`} fill={h} />}
      <path d={`M${x - 42} ${y + 84} Q${x - 42} ${y + 40} ${x - 15} ${y + 33} L${x + 15} ${y + 33} Q${x + 42} ${y + 40} ${x + 42} ${y + 84} Z`} fill={p.suit} />
      <rect x={x - 8} y={y + 18} width={16} height={17} fill={p.skin} />
      <path d={`M${x - 13} ${y + 33} L${x} ${y + 58} L${x + 13} ${y + 33} Z`} fill="#f3f1ec" />
      {p.tie && <path d={`M${x - 4} ${y + 37} L${x + 4} ${y + 37} L${x + 6} ${y + 60} L${x} ${y + 67} L${x - 6} ${y + 60} Z`} fill={p.tie} />}
      <ellipse cx={x} cy={y} rx={22} ry={25} fill={p.skin} />
      {p.style === 'short' && <path d={`M${x - 23} ${y - 2} Q${x - 25} ${y - 31} ${x} ${y - 30} Q${x + 25} ${y - 31} ${x + 23} ${y - 2} Q${x + 17} ${y - 17} ${x} ${y - 17} Q${x - 15} ${y - 18} ${x - 23} ${y - 2} Z`} fill={h} />}
      {p.style === 'side' && <path d={`M${x - 23} ${y} Q${x - 25} ${y - 32} ${x + 2} ${y - 30} Q${x + 26} ${y - 29} ${x + 23} ${y - 2} Q${x + 10} ${y - 20} ${x - 8} ${y - 14} Q${x - 16} ${y - 12} ${x - 23} ${y} Z`} fill={h} />}
      {(p.style === 'long' || p.style === 'bob') && <path d={`M${x - 23} ${y - 2} Q${x - 24} ${y - 30} ${x} ${y - 29} Q${x + 24} ${y - 30} ${x + 23} ${y - 2} Q${x + 12} ${y - 16} ${x - 4} ${y - 15} Q${x - 16} ${y - 14} ${x - 23} ${y - 2} Z`} fill={h} />}
      <circle cx={x - 8} cy={y + 2} r={2.3} fill="#2b2420" /><circle cx={x + 8} cy={y + 2} r={2.3} fill="#2b2420" />
      {p.glasses && <g fill="none" stroke="#2b2420" strokeWidth="1.6"><circle cx={x - 8} cy={y + 2} r={6.5} /><circle cx={x + 8} cy={y + 2} r={6.5} /><path d={`M${x - 1.5} ${y + 2} L${x + 1.5} ${y + 2}`} /></g>}
      <path d={`M${x - 6} ${y + 12} Q${x} ${speaking ? 18 : 16} ${x + 6} ${y + 12}`.replace(`Q${x} ${speaking ? 18 : 16}`, `Q${x} ${y + (speaking ? 18 : 16)}`)} stroke="#7a3b2e" strokeWidth="1.8" fill={speaking ? '#7a3b2e' : 'none'} strokeLinecap="round" />
      <circle cx={x - 14} cy={y + 9} r={4} fill="#e88b7a" opacity=".25" /><circle cx={x + 14} cy={y + 9} r={4} fill="#e88b7a" opacity=".25" />
      {speaking && <g className="cr-wave" stroke="currentColor" fill="none" strokeWidth="2" strokeLinecap="round"><path d={`M${x + 32} ${y - 8} q6 8 0 16`} /><path d={`M${x + 39} ${y - 14} q10 14 0 28`} /></g>}
    </g>
  );
}

