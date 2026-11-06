// The charts of one page move together, as on a CloudWatch dashboard: pointing
// at a time in one chart shows that time in all of them, and zooming one into a
// span of time zooms all of them.

import { useEffect, useId, useMemo, useState } from "react";
import { echarts, type EChartsType } from "./echarts.ts";

export interface ChartGroup {
  /** The name that ECharts connects the charts by. */
  readonly id: string;
  /** Adds a chart to the group and returns the function that takes it out. */
  add(chart: EChartsType): () => void;
  /** Shows the whole range again in every chart of the group. */
  resetZoom(): void;
  /** A chart reports here that the charts zoomed in or out. */
  setZoomed(zoomed: boolean): void;
  /** Brings out a resource in every chart of the group, or none with null. */
  highlight(key: string | null): void;
}

export function useChartGroup(): { group: ChartGroup; zoomed: boolean } {
  const id = useId();
  const [zoomed, setZoomed] = useState(false);
  const group = useMemo<ChartGroup>(() => {
    const charts = new Set<EChartsType>();
    return {
      id,
      add(chart) {
        charts.add(chart);
        return () => {
          charts.delete(chart);
        };
      },
      resetZoom() {
        // ECharts passes the zoom of one chart on to the others in the group.
        const [first] = charts;
        first?.dispatchAction({ type: "dataZoom", start: 0, end: 100 });
        setZoomed(false);
      },
      setZoomed,
      highlight(key) {
        // ECharts passes the highlight of one chart on to the others in the group.
        const [first] = charts;
        first?.dispatchAction({ type: "downplay" });
        if (key !== null) first?.dispatchAction({ type: "highlight", seriesId: key });
      },
    };
  }, [id]);

  useEffect(() => {
    echarts.connect(id);
    return () => echarts.disconnect(id);
  }, [id]);

  return { group, zoomed };
}
