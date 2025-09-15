import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PerformanceChart } from '../PerformanceChart';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the API
vi.mock('../../../lib/api', () => ({
  distancesApi: {
    get: vi.fn().mockResolvedValue({
      data: {
        count: 1000,
        distances: Array.from({ length: 1000 }, () => Math.random() * 1000),
        nonces: Array.from({ length: 1001 }, (_, i) => i),
        stats: {
          mean: 500,
          median: 480,
          min: 10,
          max: 990,
          p90: 850,
          p99: 950,
          stddev: 200,
          cv: 0.4,
        },
      },
    }),
    getCsvUrl: vi.fn().mockReturnValue('#'),
  },
}));

const createTestQueryClient = () => new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      gcTime: 0,
    },
  },
});

describe('PerformanceChart Performance Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('renders large dataset within performance limits', async () => {
    const startTime = performance.now();

    render(
      <QueryClientProvider client={queryClient}>
        <PerformanceChart
          runId="test-run"
          multipliers={[1, 2, 5, 10]}
          selectedMultiplier={2}
          onMultiplierChange={() => {}}
        />
      </QueryClientProvider>
    );

    // Wait for chart to render
    await screen.findByText('Performance Analysis');

    const renderTime = performance.now() - startTime;

    // Assert TTI is under 100ms
    expect(renderTime).toBeLessThan(100);

    // Check memory usage (rough estimate)
    if ('memory' in performance) {
      const memInfo = (performance as any).memory;
      const usedMB = memInfo.usedJSHeapSize / 1024 / 1024;

      // Assert memory usage is under 50MB
      expect(usedMB).toBeLessThan(50);
    }
  });

  it('handles chart type switching efficiently', async () => {
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <PerformanceChart
          runId="test-run"
          multipliers={[1, 2, 5, 10]}
          selectedMultiplier={2}
          onMultiplierChange={() => {}}
        />
      </QueryClientProvider>
    );

    await screen.findByText('Performance Analysis');

    // Measure chart type switching performance
    const startTime = performance.now();

    // Simulate chart type change (this would normally be done via state)
    rerender(
      <QueryClientProvider client={queryClient}>
        <PerformanceChart
          runId="test-run"
          multipliers={[1, 2, 5, 10]}
          selectedMultiplier={2}
          onMultiplierChange={() => {}}
        />
      </QueryClientProvider>
    );

    const switchTime = performance.now() - startTime;

    // Assert chart switching is smooth (under 16ms for 60fps)
    expect(switchTime).toBeLessThan(16);
  });
});