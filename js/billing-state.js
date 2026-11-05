// Tiny shared state so api.js, ui.js and export.js can enforce the read-only lock without importing the UI.
let B = null; let onBlock = null; const subs = new Set();
export const getBilling = () => B;
export const isLocked = () => !!(B && B.locked);
export function setBilling(b) { B = b; document.body.classList.toggle('is-locked', isLocked()); subs.forEach(f => { try { f(B); } catch (e) { console.error(e); } }); }
export const onBilling = f => { subs.add(f); return () => subs.delete(f); };
export const setBlockHandler = f => { onBlock = f; };
/** Returns true (and shows the "renew" popup) when the business is locked. kind: 'write' | 'export'. */
export function blocked(kind = 'write') { if (!isLocked()) return false; if (onBlock) onBlock(kind); return true; }
