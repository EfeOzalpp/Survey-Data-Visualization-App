// src/graph-runtime/VisualizationPage.tsx
// Graph page: loads DotGraph only; auxiliary panels live in navigation widgets
import React, { Suspense, useMemo } from 'react';

const Graph = React.lazy(() =>
  import(/* webpackChunkName: "graph" */ "./dotgraph/data-boundary")
);

function VisualizationPage() {
  const pageLoadingFallback = useMemo(
    () => (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 5,
          pointerEvents: 'none',
          minHeight: '100dvh',
          background: 'var(--ui-bg-page)'
        }}
        aria-busy="true"
        aria-live="polite"
      >
        <h4 style={{ opacity: 0.85 }}>Loading...</h4>
      </div>
    ),
    []
  );

  return (
    <Suspense fallback={pageLoadingFallback}>
      <Graph />
    </Suspense>
  );
}

export default React.memo(VisualizationPage);
