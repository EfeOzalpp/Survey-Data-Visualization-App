import * as React from "react";

import { GraphDataContext } from "./graphDataContextObject";

export function useSharedGraphData() {
  const ctx = React.useContext(GraphDataContext);
  if (!ctx) {
    throw new Error("useSharedGraphData must be used within GraphDataProvider");
  }
  return ctx;
}
