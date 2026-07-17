import React, { useEffect, useRef } from 'react';
import './WarpTransition.css';

/**
 * The jump between views: a starfield accelerating out of the centre, peaking as
 * the shell swaps underneath, then settling. Canvas rather than DOM because a
 * few hundred streaks per frame would thrash layout as elements.
 *
 * Mounted only while warping, so it costs nothing at rest.
 */

const STARS = 320;
const DURATION = 1000;

export default function WarpTransition({ active }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        if (!active) return undefined;
        const canvas = canvasRef.current;
        if (!canvas) return undefined;
        const ctx = canvas.getContext('2d');
        const dpr = Math.min(window.devicePixelRatio || 1, 2);

        const resize = () => {
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
        };
        resize();
        window.addEventListener('resize', resize);

        // Each star is an angle plus a starting radius; they fly straight out.
        const stars = Array.from({ length: STARS }, () => ({
            angle: Math.random() * Math.PI * 2,
            radius: Math.random(),
            speed: Math.random() * 0.7 + 0.35,
            hue: Math.random() < 0.22 ? 'accent' : 'star'
        }));

        const start = performance.now();
        let raf = 0;

        const tick = (now) => {
            const t = Math.min(1, (now - start) / DURATION);
            // Accelerate in, decelerate out — the swap lands at peak speed.
            const speed = Math.sin(t * Math.PI);
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            const maxR = Math.hypot(canvas.width, canvas.height) / 2;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.lineCap = 'round';

            for (const s of stars) {
                const progress = (s.radius + speed * 0.85 * s.speed) % 1.25;
                const r0 = progress * maxR;
                const len = (8 + speed * 170 * s.speed) * dpr;
                const cos = Math.cos(s.angle);
                const sin = Math.sin(s.angle);
                const alpha = Math.min(1, 0.1 + speed * 0.9) * (1 - Math.abs(progress - 0.6));
                if (alpha <= 0) continue;

                ctx.strokeStyle = s.hue === 'accent'
                    ? `rgba(129, 140, 248, ${alpha})`
                    : `rgba(226, 232, 240, ${alpha * 0.85})`;
                ctx.lineWidth = (0.5 + s.speed * 1.5) * dpr;
                ctx.beginPath();
                ctx.moveTo(cx + cos * r0, cy + sin * r0);
                ctx.lineTo(cx + cos * (r0 + len), cy + sin * (r0 + len));
                ctx.stroke();
            }

            if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
        };
    }, [active]);

    if (!active) return null;

    return (
        <div className="warp" aria-hidden="true">
            <canvas ref={canvasRef} className="warp-canvas" />
            <div className="warp-core" />
        </div>
    );
}
