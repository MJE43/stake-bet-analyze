import { useMemo, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  MantineReactTable,
  useMantineReactTable,
  type MRT_ColumnDef,
} from "mantine-react-table";
import { Text, Badge, Checkbox } from "@mantine/core";
import { type Hit } from "@/lib/api";

interface HitsTableProps {
  hits: Hit[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  onFilterChange: (filters: { minMultiplier?: number }) => void;
  runTargets: number[];
}

const HitsTable = ({
  hits,
  total,
  isLoading,
  isError,
  error,
  page,
  pageCount,
  onPageChange,
  onFilterChange,
  runTargets,
}: HitsTableProps) => {


  // Debounce filter changes
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedFilterChange = useCallback((filters: { minMultiplier?: number }) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      onFilterChange(filters);
    }, 200); // 200ms debounce
  }, [onFilterChange]);

  // Define columns with memoization
  const columns = useMemo<MRT_ColumnDef<Hit>[]>(
    () => [
      {
        id: "select",
        header: "",
        Cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            size="sm"
          />
        ),
        size: 50,
        enableSorting: false,
        enableColumnFilter: false,
      },
      {
        accessorKey: "nonce",
        header: "Nonce",
        size: 120,
        enableColumnFilter: false,
        Cell: ({ cell }) => (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="font-mono text-sm text-slate-300"
          >
            {cell.getValue<number>().toLocaleString()}
          </motion.div>
        ),
      },
      {
        accessorKey: "max_multiplier",
        header: "Max Multiplier",
        size: 140,
        filterVariant: "select",
        filterFn: "greaterThanOrEqualTo",
        mantineFilterSelectProps: {
          data: runTargets.map(target => ({
            value: target.toString(),
            label: `≥ ${target}×`
          })),
          placeholder: "Filter by Target",
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
            value >= 1000 ? "red" :
            value >= 100 ? "orange" :
            value >= 10 ? "yellow" :
            "green";

          const intensity =
            value >= 1000 ? 9 :
            value >= 100 ? 7 :
            value >= 10 ? 5 :
            3;

          return (
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.05 }}
            >
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
                  textAlign: "center",
                  backgroundColor: `hsl(var(--mantine-color-${color}-${intensity}))`,
                  color: "white",
                }}
              >
                {value.toFixed(2)}×
              </Badge>
            </motion.div>
          );
        },
      },
      {
        accessorKey: "distance_prev",
        header: "Distance",
        size: 120,
        enableColumnFilter: false,
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
                —
              </Text>
            );
          }

          // Enhanced color coding with better contrast
          const getDistanceColor = (dist: number) => {
            if (dist <= 10) return "hsl(142 76% 36%)"; // Dark green for very close
            if (dist <= 50) return "hsl(38 92% 50%)"; // Orange for close
            if (dist <= 200) return "hsl(24 95% 53%)"; // Red-orange for medium
            return "hsl(215.4 16.3% 46.9%)"; // Gray for far
          };

          const getDistanceBg = (dist: number) => {
            if (dist <= 10) return "hsl(142 76% 10%)";
            if (dist <= 50) return "hsl(38 92% 10%)";
            if (dist <= 200) return "hsl(24 95% 10%)";
            return "transparent";
          };

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="font-mono text-sm px-2 py-1 rounded"
              style={{
                color: getDistanceColor(value),
                backgroundColor: getDistanceBg(value),
                fontWeight: 600,
              }}
            >
              {value.toLocaleString()}
            </motion.div>
          );
        },
      },
    ],
    [runTargets]
  );

  // Memoize table data
  const tableData = useMemo(() => hits, [hits]);



  const table = useMantineReactTable({
    columns,
    data: tableData,
    enablePagination: true,
    enableRowVirtualization: true,
    rowVirtualizerProps: {
      overscan: 10, // Increase overscan for smoother scrolling
      estimateSize: () => 60, // Estimate row height for better performance
    },
    manualPagination: true,
    manualFiltering: true,
    manualSorting: false,
    enableFacetedValues: false,

    filterFns: {
      greaterThanOrEqualTo: (row, id, filterValue) => {
        const value = row.getValue(id);
        return Number(value) >= Number(filterValue);
      },
    },
    rowCount: total,
    pageCount,
    paginationDisplayMode: "pages",
    mantinePaginationProps: {
      showRowsPerPage: false,
    },
    onPaginationChange: (updater) => {
      const newPagination = typeof updater === 'function'
        ? updater({ pageIndex: page, pageSize: 50 })
        : updater;
      onPageChange(newPagination.pageIndex);
    },
    onColumnFiltersChange: (updater) => {
      const newFilters = typeof updater === 'function'
        ? updater([])
        : updater;

      const minMultiplierFilter = newFilters.find(f => f.id === 'max_multiplier');
      const minMultiplier = minMultiplierFilter?.value
        ? parseFloat(minMultiplierFilter.value as string)
        : undefined;

      debouncedFilterChange({ minMultiplier });
    },

    mantineTableContainerProps: {
      style: {
        maxHeight: "600px",
        backgroundColor: "hsl(222.2 84% 4.9%)",
      },
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
          children: error?.message || "Error loading hits",
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
    state: {
      isLoading,
      showAlertBanner: isError,
      showProgressBars: false,
      pagination: {
        pageIndex: page,
        pageSize: 50,
      },
    },
    initialState: {
      showColumnFilters: true,
      showGlobalFilter: false,
    },
    enableStickyHeader: true,
    enableStickyFooter: true,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <MantineReactTable table={table} />
    </motion.div>
  );
};

export default HitsTable;