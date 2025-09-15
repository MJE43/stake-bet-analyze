import {
  type UIEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
  type MRT_Virtualizer,
} from "mantine-react-table";
import { Text, Badge, Group, Stack } from "@mantine/core";
import { type BetRecord } from "@/lib/api";

interface LiveBetsTableProps {
  streamId: string;
  isPolling?: boolean;
  pollingInterval?: number;
  bets: BetRecord[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  fetchNextPage: () => void;
  refetch: () => void;
  hasNextPage: boolean;
  isFetching: boolean;
}

const LiveBetsTable = ({
  isPolling = true,
  bets,
  total,
  isLoading,
  isError,
  fetchNextPage,
  hasNextPage,
  isFetching,
}: LiveBetsTableProps) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const rowVirtualizerInstanceRef =
    useRef<MRT_Virtualizer<HTMLDivElement, HTMLTableRowElement>>(null);

  const flatData = useMemo(() => bets, [bets]);

  const totalDBRowCount = total;
  const totalFetched = flatData.length;

  // Debounced fetch more on scroll
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const fetchMoreOnBottomReached = useCallback(
    (containerRefElement?: HTMLDivElement | null) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        if (containerRefElement && hasNextPage && !isFetching) {
          const { scrollHeight, scrollTop, clientHeight } = containerRefElement;
          if (scrollHeight - scrollTop - clientHeight < 400) {
            fetchNextPage();
          }
        }
      }, 100);
    },
    [fetchNextPage, hasNextPage, isFetching]
  );

  // Check if we need to fetch more data on mount
  useEffect(() => {
    if (hasNextPage && !isFetching) {
      fetchMoreOnBottomReached(tableContainerRef.current);
    }
  }, [fetchMoreOnBottomReached, hasNextPage, isFetching]);

  // Define columns
  const columns = useMemo<MRT_ColumnDef<BetRecord>[]>(
    () => [
      {
        accessorKey: "nonce",
        header: "Nonce",
        size: 100,
        enableColumnFilter: false, // Disable filtering for nonce as it's not useful
        Cell: ({ cell }) => (
          <Text 
            size="sm" 
            ff="monospace" 
            fw={500}
            style={{ 
              color: "hsl(210 40% 98%)",
              letterSpacing: "0.025em",
              fontSize: "0.8125rem"
            }}
          >
            {cell.getValue<number>().toLocaleString()}
          </Text>
        ),
      },
      {
        accessorKey: "round_result",
        header: "Multiplier",
        size: 120,
        filterVariant: "select",
        filterFn: "greaterThanOrEqualTo",
        mantineFilterSelectProps: {
          data: [
            { value: "400.02", label: "≥ 400.02×" },
            { value: "1066.73", label: "≥ 1066.73×" },
            { value: "3200.18", label: "≥ 3200.18×" },
            { value: "11200.65", label: "≥ 11200.65×" },
            { value: "48536.13", label: "≥ 48536.13×" },
          ],
          placeholder: "Filter by Multiplier",
          clearable: true,
          searchable: false,
          styles: {
            input: {
              backgroundColor: 'hsl(222.2 84% 4.9%)',
              borderColor: 'hsl(217.2 32.6% 17.5%)',
              color: 'hsl(210 40% 98%)',
              fontSize: '0.875rem',
              '&:focus': {
                borderColor: 'hsl(217.2 91.2% 59.8%)',
              },
            },
            dropdown: {
              backgroundColor: 'hsl(222.2 84% 4.9%)',
              border: '1px solid hsl(217.2 32.6% 17.5%)',
            },
            item: {
              color: 'hsl(210 40% 98%)',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              '&[data-selected]': {
                backgroundColor: 'hsl(217.2 91.2% 59.8%)',
                color: 'white',
              },
              '&[data-hovered]': {
                backgroundColor: 'hsl(210 40% 8%)',
              },
            },
            rightSection: {
              color: 'hsl(215.4 16.3% 46.9%)',
            },
          },
        },
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          const color =
            value >= 1000
              ? "red"
              : value >= 100
              ? "orange"
              : value >= 10
              ? "yellow"
              : "green";
          return (
            <Badge 
              color={color} 
              variant="light" 
              size="md"
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                fontFamily: "monospace",
                padding: "0.375rem 0.75rem",
                minWidth: "80px",
                textAlign: "center"
              }}
            >
              {value?.toFixed(2)}×
            </Badge>
          );
        },
      },
      {
        accessorKey: "distance_prev_opt",
        header: "Distance",
        size: 100,
        filterVariant: "range",
        filterFn: "betweenInclusive",
        Cell: ({ cell }) => {
          const value = cell.getValue<number | null>();
          if (value === null || value === undefined) {
            return (
              <Text 
                size="sm" 
                style={{ 
                  color: "hsl(215.4 16.3% 46.9%)",
                  fontStyle: "italic"
                }}
              >
                -
              </Text>
            );
          }
          
          // Color coding based on distance ranges
          const getDistanceColor = (dist: number) => {
            if (dist <= 10) return "hsl(120 100% 75%)"; // Green for very close
            if (dist <= 50) return "hsl(60 100% 75%)"; // Yellow for close
            if (dist <= 200) return "hsl(30 100% 75%)"; // Orange for medium
            return "hsl(210 40% 98%)"; // Default white for far
          };
          
          return (
            <Text
              size="sm"
              ff="monospace"
              fw={600}
              style={{ 
                color: getDistanceColor(value),
                letterSpacing: "0.025em",
                fontSize: "0.8125rem"
              }}
            >
              {value.toLocaleString()}
            </Text>
          );
        },
      },
      {
        accessorKey: "amount",
        header: "Amount",
        size: 100,
        enableColumnFilter: false, // Disable filtering for amount since it's usually 0
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return (
            <Text 
              size="sm" 
              ff="monospace"
              style={{ 
                color: value > 0 ? "hsl(120 100% 75%)" : "hsl(215.4 16.3% 46.9%)",
                fontSize: "0.8125rem",
                letterSpacing: "0.025em"
              }}
            >
              ${value.toFixed(2)}
            </Text>
          );
        },
      },
      {
        accessorKey: "payout",
        header: "Payout",
        size: 100,
        enableColumnFilter: false, // Disable filtering for payout since it's usually 0
        Cell: ({ cell }) => {
          const value = cell.getValue<number>();
          return (
            <Text 
              size="sm" 
              ff="monospace"
              fw={value > 0 ? 600 : 400}
              style={{ 
                color: value > 0 ? "hsl(120 100% 75%)" : "hsl(215.4 16.3% 46.9%)",
                fontSize: "0.8125rem",
                letterSpacing: "0.025em"
              }}
            >
              ${value.toFixed(2)}
            </Text>
          );
        },
      },
      {
        accessorKey: "difficulty",
        header: "Difficulty",
        size: 100,
        filterVariant: "select",
        filterFn: "equals", // Use equals for exact difficulty matching with faceted values
        Cell: ({ cell }) => {
          const difficulty = cell.getValue<string>();
          const color =
            {
              easy: "green",
              medium: "yellow",
              hard: "orange",
              expert: "red",
            }[difficulty] || "gray";

          return (
            <Badge color={color} variant="outline" size="sm">
              {difficulty}
            </Badge>
          );
        },
      },
      {
        accessorKey: "date_time",
        header: "Time",
        size: 150,
        enableColumnFilter: false, // Disable date filtering for simplicity in live data
        Cell: ({ cell }) => {
          const value = cell.getValue<string>();
          if (!value)
            return (
              <Text 
                size="sm" 
                style={{ 
                  color: "hsl(215.4 16.3% 46.9%)",
                  fontStyle: "italic"
                }}
              >
                -
              </Text>
            );

          const date = new Date(value);
          const now = new Date();
          const diffMinutes = (now.getTime() - date.getTime()) / (1000 * 60);
          
          // Color coding based on recency
          const getTimeColor = (minutes: number) => {
            if (minutes < 1) return "hsl(120 100% 75%)"; // Green for very recent
            if (minutes < 5) return "hsl(60 100% 75%)"; // Yellow for recent
            if (minutes < 30) return "hsl(30 100% 75%)"; // Orange for somewhat recent
            return "hsl(210 40% 98%)"; // Default white for older
          };
          
          return (
            <Text 
              size="sm" 
              ff="monospace"
              fw={500}
              style={{ 
                color: getTimeColor(diffMinutes),
                fontSize: "0.8125rem",
                letterSpacing: "0.025em"
              }}
            >
              {date.toLocaleTimeString([], { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit', 
                second: '2-digit' 
              })}
            </Text>
          );
        },
      },
    ],
    []
  );

  const table = useMantineReactTable({
    columns,
    data: flatData,
    enablePagination: false,
    enableRowNumbers: true,
    enableRowVirtualization: true,
    manualFiltering: false, // Enable client-side filtering
    manualSorting: false, // Enable client-side sorting
    enableFacetedValues: false, // Disable faceted values
    filterFns: {
      greaterThanOrEqualTo: (row, id, filterValue) => {
        const value = row.getValue(id);
        return Number(value) >= Number(filterValue);
      },
    },
    mantineTableContainerProps: {
      ref: tableContainerRef,
      style: {
        maxHeight: "600px",
        backgroundColor: "hsl(222.2 84% 4.9%)", // Match card background
      },
      onScroll: (event: UIEvent<HTMLDivElement>) =>
        fetchMoreOnBottomReached(event.target as HTMLDivElement),
    },
    mantineTableProps: {
      style: {
        backgroundColor: "hsl(222.2 84% 4.9%)",
        border: "1px solid hsl(217.2 32.6% 17.5%)",
        borderRadius: "0.5rem",
      },
    },
    mantineTableHeadProps: {
      style: {
        backgroundColor: "hsl(210 40% 8%)",
      },
    },
    mantineTableBodyProps: {
      style: {
        backgroundColor: "hsl(222.2 84% 4.9%)",
      },
    },
    mantineToolbarAlertBannerProps: isError
      ? {
          color: "red",
          children: "Error loading data",
        }
      : undefined,
    mantineTopToolbarProps: {
      style: {
        backgroundColor: "hsl(222.2 84% 4.9%)",
        borderBottom: "1px solid hsl(217.2 32.6% 17.5%)",
      },
    },
    mantineBottomToolbarProps: {
      style: {
        backgroundColor: "hsl(222.2 84% 4.9%)",
        borderTop: "1px solid hsl(217.2 32.6% 17.5%)",
      },
    },
    // Remove manual filter/sort handlers since we're using client-side now
    renderBottomToolbarCustomActions: () => (
      <Group>
        <Text size="sm" style={{ color: "hsl(215.4 16.3% 46.9%)" }}>
          Fetched {totalFetched.toLocaleString()} of{" "}
          {totalDBRowCount.toLocaleString()} total bets
        </Text>
        {isPolling && (
          <Badge color="green" variant="dot" size="sm">
            Live
          </Badge>
        )}
      </Group>
    ),
    state: {
      isLoading,
      showAlertBanner: isError,
      showProgressBars: isFetching, // Show progress during fetching
    },
    initialState: {
      showColumnFilters: true, // Show filters by default
      showGlobalFilter: true, // Show global search
    },
    // Add options to reduce re-render flash
    enableStickyHeader: true,
    enableStickyFooter: true,
    rowVirtualizerInstanceRef,
    rowVirtualizerProps: { overscan: 10 },
  });

  return (
    <Stack>
      <MantineReactTable table={table} />
    </Stack>
  );
};

export default LiveBetsTable;
