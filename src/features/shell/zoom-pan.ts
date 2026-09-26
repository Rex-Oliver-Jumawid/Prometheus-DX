/** Route zoomed desktop trackpad gestures to one consistent page pan surface. */
export function installZoomPan(): () => void {
  const viewport = window.visualViewport;
  const desktopPointer = window.matchMedia(
    '(hover: hover) and (pointer: fine)',
  );
  const root = document.documentElement;
  const workspace = document.querySelector<HTMLElement>(
    '.workspace-content-scroll',
  );
  if (!workspace) return () => undefined;

  const update = () => {
    // Browser zoom shrinks innerWidth; pinch-zoom changes visualViewport.scale.
    const active =
      desktopPointer.matches &&
      (window.innerWidth < 1180 || (viewport?.scale ?? 1) > 1.01);
    const visualExtra =
      active && viewport
        ? Math.ceil(Math.max(0, window.innerWidth - viewport.width))
        : 0;
    const contentWidth = Math.max(
      window.innerWidth,
      document.querySelector<HTMLElement>('.workspace-shell')?.scrollWidth ?? 0,
    );

    root.classList.toggle('zoom-pan-active', active);
    root.style.setProperty('--zoom-pan-spacer-start', `${contentWidth}px`);
    root.style.setProperty('--zoom-pan-spacer-width', `${visualExtra}px`);
  };

  const pan = (event: WheelEvent) => {
    if (
      !root.classList.contains('zoom-pan-active') ||
      event.defaultPrevented ||
      event.ctrlKey ||
      (event.target instanceof Element &&
        event.target.closest(
          '[role="dialog"], [aria-modal="true"], textarea, [contenteditable="true"]',
        ))
    ) {
      return;
    }

    const multiplier =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? window.innerHeight
          : 1;
    const shiftHorizontal = event.shiftKey && event.deltaX === 0;
    const horizontal =
      (shiftHorizontal ? event.deltaY : event.deltaX) * multiplier;
    const vertical = (shiftHorizontal ? 0 : event.deltaY) * multiplier;
    if (horizontal === 0 && vertical === 0) return;

    event.preventDefault();
    if (horizontal !== 0) {
      window.scrollBy({ left: horizontal, top: 0, behavior: 'auto' });
    }
    if (vertical !== 0) {
      workspace.scrollTop += vertical;
    }
  };

  update();
  viewport?.addEventListener('resize', update);
  window.addEventListener('resize', update);
  window.addEventListener('wheel', pan, { capture: true, passive: false });

  return () => {
    viewport?.removeEventListener('resize', update);
    window.removeEventListener('resize', update);
    window.removeEventListener('wheel', pan, true);
    root.classList.remove('zoom-pan-active');
    root.style.removeProperty('--zoom-pan-spacer-start');
    root.style.removeProperty('--zoom-pan-spacer-width');
  };
}
