import * as React from "react";

import useGraphData from "./useGraphData";

export type GraphDataState = ReturnType<typeof useGraphData>;

export const GraphDataContext = React.createContext<GraphDataState | null>(null);
