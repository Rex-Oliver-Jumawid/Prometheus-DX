import { afterEach, describe, expect, it, vi } from 'vitest';
import { installZoomPan } from './zoom-pan';

const originalVisualViewport = window.visualViewport;
const originalMatchMedia = window.matchMedia;
const originalWidth = window.innerWidth;
let cleanup: (() => void) | undefined;

function mount(scale: number, width: number) {
  const viewport = {
    scale,
    width: width / scale,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  });
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: true }),
  });
  document.body.innerHTML =
    '<div class="workspace-shell"><div class="workspace-content-scroll"></div></div>';
  const workspace = document.querySelector<HTMLElement>(
    '.workspace-content-scroll',
  )!;
  const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
  cleanup = installZoomPan();
  return { viewport, workspace, scroll };
}

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = '';
  document.documentElement.classList.remove('zoom-pan-active');
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: originalVisualViewport,
  });
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: originalWidth,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
  });
  vi.restoreAllMocks();
});

describe('zoomed workspace panning', () => {
  it('routes diagonal gestures over any panel to page x and workspace y', () => {
    const { workspace, scroll } = mount(1, 900);
    const nested = document.createElement('div');
    workspace.append(nested);
    const gesture = new WheelEvent('wheel', {
      deltaX: 80,
      deltaY: 45,
      bubbles: true,
      cancelable: true,
    });
    nested.dispatchEvent(gesture);
    expect(gesture.defaultPrevented).toBe(true);
    expect(scroll).toHaveBeenCalledWith({
      left: 80,
      top: 0,
      behavior: 'auto',
    });
    expect(workspace.scrollTop).toBe(45);
  });

  it('enables pinch-zoom panning even if the CSS viewport remains wide', () => {
    const { viewport, scroll } = mount(2, 1440);
    expect(document.documentElement.classList.contains('zoom-pan-active')).toBe(
      true,
    );
    expect(
      document.documentElement.style.getPropertyValue('--zoom-pan-spacer-width'),
    ).toBe('720px');
    const gesture = new WheelEvent('wheel', {
      deltaX: 80,
      cancelable: true,
    });
    window.dispatchEvent(gesture);
    expect(scroll).toHaveBeenCalledWith({
      left: 80,
      top: 0,
      behavior: 'auto',
    });
    expect(viewport.addEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    );
  });

  it('leaves normal scrolling and native browser pinch gestures alone', () => {
    const { scroll } = mount(1, 1440);
    const wheel = new WheelEvent('wheel', {
      deltaY: 60,
      cancelable: true,
    });
    window.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect(scroll).not.toHaveBeenCalled();
    cleanup?.();
    const zoomed = mount(2, 1440);
    const pinch = new WheelEvent('wheel', {
      ctrlKey: true,
      deltaY: -50,
      cancelable: true,
    });
    window.dispatchEvent(pinch);
    expect(pinch.defaultPrevented).toBe(false);
    expect(zoomed.scroll).not.toHaveBeenCalled();
  });

  it('does not hijack scroll gestures inside dialogs', () => {
    const { scroll } = mount(2, 1440);
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    document.body.append(dialog);
    const wheel = new WheelEvent('wheel', {
      deltaX: 55,
      bubbles: true,
      cancelable: true,
    });
    dialog.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect(scroll).not.toHaveBeenCalled();
  });
});
