import { useEffect } from 'react';

export function useEscapeKey(callback: () => void, condition: boolean = true) {
  useEffect(() => {
    if (!condition) return;
    
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        callback();
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [callback, condition]);
}
