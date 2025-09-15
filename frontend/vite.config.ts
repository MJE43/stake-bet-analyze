import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large dependencies into separate chunks
          recharts: ['recharts'],
          'mantine-core': ['@mantine/core'],
          'mantine-table': ['mantine-react-table'],
          'framer-motion': ['framer-motion'],
          'react-query': ['@tanstack/react-query'],
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Increase warning limit
  },
  optimizeDeps: {
    include: [
      'recharts',
      '@mantine/core',
      'mantine-react-table',
      'framer-motion',
      '@tanstack/react-query',
    ],
  },
});
