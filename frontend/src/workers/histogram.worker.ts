// Web Worker for histogram calculations
interface HistogramMessage {
  type: 'calculate';
  distances: number[];
  binCount: number;
}

interface HistogramResult {
  type: 'result';
  bins: Array<{
    range: string;
    count: number;
    min: number;
    max: number;
  }>;
}

self.onmessage = (e: MessageEvent<HistogramMessage>) => {
  const { type, distances, binCount } = e.data;

  if (type === 'calculate') {
    const min = Math.min(...distances);
    const max = Math.max(...distances);
    const binSize = (max - min) / binCount;

    const bins = Array.from({ length: binCount }, (_, i) => ({
      range: `${Math.floor(min + i * binSize)}-${Math.floor(min + (i + 1) * binSize)}`,
      count: 0,
      min: min + i * binSize,
      max: min + (i + 1) * binSize,
    }));

    distances.forEach((distance) => {
      const binIndex = Math.min(Math.floor((distance - min) / binSize), binCount - 1);
      if (bins[binIndex]) {
        bins[binIndex].count++;
      }
    });

    const result: HistogramResult = {
      type: 'result',
      bins: bins.filter(bin => bin.count > 0),
    };

    self.postMessage(result);
  }
};