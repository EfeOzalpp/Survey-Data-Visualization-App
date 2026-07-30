import * as React from "react";

import useGraphData from "./useGraphData";
import { GraphDataContext } from "./graphDataContextObject";

export function GraphDataProvider({
  data,
  children,
}: {
  data: unknown;
  children: React.ReactNode;
}) {
  const value = useGraphData(data);
  return <GraphDataContext.Provider value={value}>{children}</GraphDataContext.Provider>;
}
