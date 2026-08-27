import React from 'react';
import './WarpTransition.css';

/**
 * The switch between views.
 *
 * Deliberately simple: a frosted veil settles over the shell, one luminous sweep
 * passes through it, and it clears — the shell changes underneath while covered.
 * No canvas and no per-frame work; it is pure compositor (opacity/transform/
 * filter), which is why it stays smooth on a busy dashboard.
 *
 * Mounted only while switching, so it costs nothing at rest.
 */
export default function WarpTransition({ active }) {
    if (!active) return null;
    return (
        <div className="warp" aria-hidden="true">
            <div className="warp-sweep" />
            <div className="warp-pulse" />
        </div>
    );
}
