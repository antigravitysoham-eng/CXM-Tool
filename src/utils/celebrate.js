// Dependency-free confetti burst via the Web Animations API.
export function confettiBurst() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const colors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#0ea5e9', '#a855f7', '#ec4899'];
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden';
    document.body.appendChild(container);
    const n = 90;
    for (let i = 0; i < n; i++) {
        const p = document.createElement('div');
        const size = 6 + Math.random() * 7;
        p.style.cssText = `position:absolute;top:-12px;left:${Math.random() * 100}%;width:${size}px;height:${size}px;background:${colors[i % colors.length]};border-radius:${Math.random() > 0.5 ? '50%' : '2px'}`;
        container.appendChild(p);
        const dx = (Math.random() - 0.5) * 340;
        const dur = 1600 + Math.random() * 1600;
        const rot = Math.random() * 720;
        p.animate(
            [
                { transform: 'translate(0,0) rotate(0deg)', opacity: 1 },
                { transform: `translate(${dx}px, ${window.innerHeight + 60}px) rotate(${rot}deg)`, opacity: 0.9 }
            ],
            { duration: dur, easing: 'cubic-bezier(.2,.6,.4,1)' }
        ).onfinish = () => p.remove();
    }
    setTimeout(() => container.remove(), 3400);
}
