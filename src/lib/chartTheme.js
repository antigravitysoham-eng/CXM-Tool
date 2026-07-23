/**
 * Shared recharts styling.
 *
 * Recharts defaults a tooltip's label to #666 and colours each item by its
 * series, neither of which it checks against the surface it is drawn on. On the
 * dark theme that puts near-black text on a near-black panel, and a dark slice
 * colour (deep indigo, plum) does the same on light. Styling `contentStyle`
 * alone — which is what every chart here used to do — only fixes the box.
 *
 * Spread `tooltipProps` onto a <Tooltip> to get a readable box on both themes.
 */

const surface = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    boxShadow: 'var(--shadow-md)',
    padding: '8px 11px',
    fontSize: 12
};

export const tooltipProps = {
    contentStyle: surface,
    // Force both the series name/value and the category label onto the theme's
    // own text colours rather than recharts' hard-coded greys and series hues.
    itemStyle: { color: 'var(--text-primary)', fontSize: 12, padding: '1px 0' },
    // --text-secondary rather than --text-muted: the label is small text, and
    // muted only reaches ~3:1 on the tooltip surface.
    // No margin here: recharts already sets the `margin` shorthand on this
    // element, and adding a longhand alongside it makes React warn on rerender.
    labelStyle: { color: 'var(--text-secondary)', fontSize: 11, fontWeight: 600 },
    cursor: { fill: 'var(--veil-1)' },
    // Keep the tooltip inside the viewport near the right-hand edge.
    allowEscapeViewBox: { x: false, y: false },
    wrapperStyle: { outline: 'none', zIndex: 5 }
};

/** Line/area charts want a thin crosshair rather than a filled band. */
export const lineTooltipProps = {
    ...tooltipProps,
    cursor: { stroke: 'var(--text-muted)', strokeWidth: 1, strokeDasharray: '3 3' }
};

export const axisTick = { fill: 'var(--text-secondary)', fontSize: 11 };
export const axisTickMuted = { fill: 'var(--text-muted)', fontSize: 11 };
export const gridStroke = 'var(--border-color)';
