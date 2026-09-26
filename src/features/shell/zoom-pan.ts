/**
 * When desktop browser zoom narrows the viewport, the entire workspace is a
 * single pan surface. Wheel events normally stop at nested chat, list, and
 * calendar scrollers, forcing users to swipe twice or rubber-band first.
 * Route gestures to the document only in the zoomed desktop layout.
 */
export function installZoomPan(): () => void {
  const zoomedDesktop = window.matchMedia(
    '(max-width: 1179px) and (hover: hover) and (pointer: fine)',
  );

  const panWorkspace = (event: WheelEvent) => {
    if (
      event.ctrlKey ||
      event.defaultPrevented ||
      !zoomedDesktop.matches ||
      document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1 ||
      (event.target instanceof Element &&
        event.target.closest('[role="dialog"], [aria-modal="true"]'))
    ) {
      return;
    }

    event.preventDefault();

    const scale =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? 16
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? window.innerHeight
          : 1;
    const shiftPan = event.shiftKey && event.deltaX === 0;

    window.scrollBy({
      left: (shiftPan ? event.deltaY : event.deltaX) * scale,
      top: shiftPan ? 0 : event.deltaY * scale,
      behavior: 'auto',
    });
  };

  window.addEventListener('wheel', panWorkspace, {
    capture: true,
    passive: false,
  });
  return () =>
    window.removeEventListener('wheel', panWorkspace, { capture: true });
}
