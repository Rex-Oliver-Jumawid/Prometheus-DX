import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function ProjectDialog({
  title,
  children,
  onClose,
  pending = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  pending?: boolean;
}) {
  const dialog = useRef<HTMLElement>(null);
  const previousFocus = useRef(document.activeElement as HTMLElement | null);
  useEffect(() => {
    const overflow = document.body.style.overflow;
    const restore = previousFocus.current;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      restore?.focus();
    };
  }, []);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) {
        event.preventDefault();
        onClose();
      }
      if (event.key === 'Tab') {
        const controls = Array.from(
          dialog.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]',
          ) ?? [],
        );
        const first = controls[0],
          last = controls.at(-1);
        if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === dialog.current)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose, pending]);
  return createPortal(
    <div
      className="projects-dialog-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
    >
      <section
        ref={dialog}
        className="projects-dialog outcome-review-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <header className="projects-dialog-header">
          <h2>{title}</h2>
          <button
            type="button"
            className="projects-icon-button"
            aria-label={`Close ${title}`}
            disabled={pending}
            onClick={onClose}
          >
            ×
          </button>
        </header>
        <div className="projects-dialog-body">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
