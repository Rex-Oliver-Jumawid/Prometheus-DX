import { afterEach, describe, expect, it, vi } from 'vitest';
import { installZoomPan } from './zoom-pan';

let cleanup: (() => void) | undefined;

function setup(zoomed: boolean, overflowing = true) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: zoomed })),
  );
  vi.spyOn(document.documentElement, 'scrollWidth', 'get').mockReturnValue(
    overflowing ? 1180 : 1000,
  );
  vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(1000);
  const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  cleanup = installZoomPan();
  return scroll;
}

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('zoomed desktop document panning', () => {
  it('routes diagonal trackpad movement over a nested scroll area to the page', () => {
    const scroll = setup(true);
    const nested = document.createElement('div');
    document.body.append(nested);
    const wheel = new WheelEvent('wheel', {
      deltaX: 72,
      deltaY: 35,
      bubbles: true,
      cancelable: true,
    });
    nested.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(true);
    expect(scroll).toHaveBeenCalledWith({
      left: 72,
      top: 35,
      behavior: 'auto',
    });
    nested.remove();
  });

  it('leaves native scrolling alone when the page is not zoomed', () => {
    const scroll = setup(false);
    const wheel = new WheelEvent('wheel', {
      deltaX: 50,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect(scroll).not.toHaveBeenCalled();
  });

  it('preserves browser pinch-to-zoom and modal scrolling', () => {
    const scroll = setup(true);
    const pinch = new WheelEvent('wheel', {
      ctrlKey: true,
      deltaY: -80,
      cancelable: true,
    });
    window.dispatchEvent(pinch);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    const wheel = new WheelEvent('wheel', {
      deltaY: 80,
      bubbles: true,
      cancelable: true,
    });
    dialog.dispatchEvent(wheel);
    expect(pinch.defaultPrevented).toBe(false);
    expect(wheel.defaultPrevented).toBe(false);
    expect(scroll).not.toHaveBeenCalled();
    dialog.remove();
  });

  it('supports shift-wheel panning horizontally', () => {
    const scroll = setup(true);
    const wheel = new WheelEvent('wheel', {
      shiftKey: true,
      deltaY: 44,
      cancelable: true,
    });
    window.dispatchEvent(wheel);
    expect(scroll).toHaveBeenCalledWith({
      left: 44,
      top: 0,
      behavior: 'auto',
    });
  });
});
