import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const MENU_GAP = 6;
const VIEWPORT_PADDING = 8;

export function FloatingMessageMenu({
  anchor,
  className,
  children,
}: {
  anchor: HTMLButtonElement | null;
  className: string;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null,
  );

  useLayoutEffect(() => {
    if (!anchor) {
      setPosition(null);
      return;
    }

    let frame = 0;

    const updatePosition = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const menu = menuRef.current;
        if (!menu || !anchor.isConnected) return;

        const anchorRect = anchor.getBoundingClientRect();
        const menuRect = menu.getBoundingClientRect();
        const spaceBelow = window.innerHeight - anchorRect.bottom;
        const spaceAbove = anchorRect.top;
        const placeAbove =
          spaceBelow < menuRect.height + MENU_GAP &&
          spaceAbove >= menuRect.height + MENU_GAP;

        const preferredTop = placeAbove
          ? anchorRect.top - menuRect.height - MENU_GAP
          : anchorRect.bottom + MENU_GAP;
        const preferredLeft = anchorRect.right - menuRect.width;

        setPosition({
          top: Math.min(
            window.innerHeight - menuRect.height - VIEWPORT_PADDING,
            Math.max(VIEWPORT_PADDING, preferredTop),
          ),
          left: Math.min(
            window.innerWidth - menuRect.width - VIEWPORT_PADDING,
            Math.max(VIEWPORT_PADDING, preferredLeft),
          ),
        });
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchor]);

  if (!anchor) return null;

  return createPortal(
    <div
      ref={menuRef}
      className={className}
      style={{
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
