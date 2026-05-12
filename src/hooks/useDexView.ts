'use client';

import { useCallback, useEffect, useState } from 'react';

export type DexViewId = 'swap' | 'pools' | 'portfolio' | 'bridge';

const DEFAULT_VIEW: DexViewId = 'swap';
const VALID_VIEWS = new Set<DexViewId>(['swap']);

function getViewFromHash(hash: string): DexViewId {
  const normalized = hash.replace(/^#/, '') as DexViewId;
  return VALID_VIEWS.has(normalized) ? normalized : DEFAULT_VIEW;
}

export function useDexView() {
  const [activeView, setActiveViewState] = useState<DexViewId>(DEFAULT_VIEW);

  useEffect(() => {
    const syncFromHash = () => {
      setActiveViewState(getViewFromHash(window.location.hash));
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);

    return () => {
      window.removeEventListener('hashchange', syncFromHash);
    };
  }, []);

  const setActiveView = useCallback((view: DexViewId) => {
    setActiveViewState(view);
    const targetHash = `#${view}`;

    if (window.location.hash === targetHash) {
      return;
    }

    window.history.replaceState(null, '', targetHash);
  }, []);

  return {
    activeView,
    setActiveView,
  };
}
