import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FloatingMessageMenu } from './FloatingMessageMenu';

function rect({
  top,
  right,
  bottom,
  left,
  width,
  height,
}: {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}): DOMRect {
  return {
    x: left,
    y: top,
    top,
    right,
    bottom,
    left,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('FloatingMessageMenu', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('portals the menu to the document and flips it above a bottom-edge trigger', () => {
    const anchor = document.createElement('button');
    document.body.append(anchor);

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 900,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
    });

    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function () {
        if (this === anchor) {
          return rect({
            top: 740,
            right: 520,
            bottom: 760,
            left: 500,
            width: 20,
            height: 20,
          });
        }
        if ((this as HTMLElement).classList.contains('test-message-menu')) {
          return rect({
            top: 0,
            right: 120,
            bottom: 72,
            left: 0,
            width: 120,
            height: 72,
          });
        }
        return rect({
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          width: 0,
          height: 0,
        });
      },
    );

    render(
      <FloatingMessageMenu anchor={anchor} className="test-message-menu">
        <button type="button">Delete message</button>
      </FloatingMessageMenu>,
    );

    const menu = screen.getByRole('button', { name: 'Delete message' }).parentElement;
    expect(menu).toHaveClass('test-message-menu');
    expect(menu?.parentElement).toBe(document.body);
    expect(menu).toHaveStyle({ top: '662px', left: '400px' });

    anchor.remove();
  });
});
