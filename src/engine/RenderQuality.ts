/** Touch devices need a bounded framebuffer and fewer expensive lighting passes. */
export function mobileRendering(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(pointer: coarse)').matches === true ||
    (navigator.maxTouchPoints > 0 && Math.min(window.innerWidth, window.innerHeight) <= 1024);
}
