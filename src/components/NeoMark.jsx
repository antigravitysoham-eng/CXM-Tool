import React from 'react';

/**
 * NEO's mark — a neural-network digital brain.
 *
 * Nodes spread across two hemispheres, wired together and lit in NEO's
 * indigo→cyan gradient. Replaces the 🧠 emoji wherever NEO shows a face.
 * `size` is px (or any CSS length); `thinking` adds a soft synaptic pulse.
 */

// Node layout on a 48×48 grid — an oval that reads as a brain, split down the
// middle into two hemispheres.
const NODES = {
    top: [24, 7], ul: [12, 14], ur: [36, 14],
    ml: [8, 25], mr: [40, 25], c: [24, 22],
    ll: [14, 37], lr: [34, 37], bot: [24, 42]
};
const EDGES = [
    ['c', 'top'], ['c', 'ul'], ['c', 'ur'], ['c', 'ml'], ['c', 'mr'], ['c', 'll'], ['c', 'lr'], ['c', 'bot'],
    ['ul', 'top'], ['ur', 'top'], ['ul', 'ml'], ['ml', 'll'], ['ll', 'bot'], ['ur', 'mr'], ['mr', 'lr'], ['lr', 'bot']
];

export default function NeoMark({ size = 40, thinking = false, color, style, className = '' }) {
    // Stable-per-instance ids so gradients/filters don't collide across marks.
    // (useId can contain ':', invalid inside url(#…) — strip it.)
    const id = `neo${React.useId().replace(/:/g, '')}`;
    // On a coloured orb, a solid (usually white) mark reads crispest; on a plain
    // surface, fall back to NEO's own indigo→cyan gradient.
    const paint = color || `url(#${id}g)`;
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 48 48"
            fill="none"
            role="img"
            aria-label="NEO"
            className={`neomark ${thinking ? 'neomark--thinking' : ''} ${className}`}
            style={style}
        >
            <defs>
                <linearGradient id={`${id}g`} x1="6" y1="4" x2="42" y2="44" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#a5b4fc" />
                    <stop offset="0.5" stopColor="#6366f1" />
                    <stop offset="1" stopColor="#22d3ee" />
                </linearGradient>
                <filter id={`${id}f`} x="-40%" y="-40%" width="180%" height="180%">
                    <feGaussianBlur stdDeviation="0.9" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
            </defs>
            <g filter={`url(#${id}f)`}>
                <g stroke={paint} strokeWidth="1.4" strokeLinecap="round" opacity="0.85">
                    {EDGES.map(([a, b], i) => (
                        <line key={i} x1={NODES[a][0]} y1={NODES[a][1]} x2={NODES[b][0]} y2={NODES[b][1]} />
                    ))}
                </g>
                <g fill={paint}>
                    {Object.entries(NODES).map(([k, [x, y]]) => (
                        <circle key={k} cx={x} cy={y} r={k === 'c' ? 3 : 2.1}>
                            {thinking && (
                                <animate
                                    attributeName="opacity"
                                    values="1;0.35;1"
                                    dur="1.4s"
                                    begin={`${(x + y) % 7 * 0.12}s`}
                                    repeatCount="indefinite"
                                />
                            )}
                        </circle>
                    ))}
                </g>
            </g>
        </svg>
    );
}
