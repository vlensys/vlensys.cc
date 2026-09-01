"use strict";
(() => {
    const bubble = document.querySelector('.status-bubble');
    const textEl = bubble?.querySelector('.status-text');
    if (!bubble || !textEl)
        return;
    const text = (textEl.textContent ?? '').trim();
    const len = text.length;
    const fontSize = Math.max(11, Math.min(16, 16 - Math.max(0, len - 20) / 15));
    const maxWidth = Math.max(90, Math.min(220, 40 + len * 2));
    bubble.style.fontSize = `${fontSize.toFixed(1)}px`;
    bubble.style.maxWidth = `${maxWidth}px`;
})();
