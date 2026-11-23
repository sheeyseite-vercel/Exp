import { useRef } from 'react';

/** Wraps a card: pressing and holding it calls onLong, and the tap that ends the hold does nothing else. */
export function LongPress({ onLong, children, ms = 550 }: { onLong: () => void; children: React.ReactNode; ms?: number }) {
  const timer = useRef<number | undefined>(undefined);
  const fired = useRef(false);
  const clear = () => window.clearTimeout(timer.current);
  return (
    <div
      style={{ display: 'contents' }}
      onPointerDown={() => {
        fired.current = false;
        clear();
        timer.current = window.setTimeout(() => {
          fired.current = true;
          onLong();
        }, ms);
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(event) => event.preventDefault()}
      onClickCapture={(event) => {
        if (fired.current) {
          event.preventDefault();
          event.stopPropagation();
          fired.current = false;
        }
      }}
    >
      {children}
    </div>
  );
}
