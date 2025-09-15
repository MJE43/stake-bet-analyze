import { z } from 'zod';

// Error model schema
export const AppErrorSchema = z.object({
  type: z.enum(['network', 'validation', 'server', 'timeout', 'unknown']),
  message: z.string(),
  context: z.object({
    component: z.string().optional(),
    queryKey: z.array(z.any()).optional(),
    timestamp: z.string(),
    userAgent: z.string().optional(),
  }),
  retryable: z.boolean(),
  maxRetries: z.number().optional(),
});

export type AppError = z.infer<typeof AppErrorSchema>;

// Error normalization utility
export const normalizeError = (error: unknown): AppError => {
  const timestamp = new Date().toISOString();

  // Handle Axios errors
  if (error && typeof error === 'object' && 'response' in error) {
    const axiosError = error as { response?: { status?: number; data?: { message?: string } }; message?: string; code?: string };
    const status = axiosError.response?.status;

    let type: AppError['type'] = 'unknown';
    let retryable = false;

    if (status && status >= 500) {
      type = 'server';
      retryable = true;
    } else if (status && status >= 400) {
      type = 'validation';
      retryable = status === 408 || status === 429;
    } else if (axiosError.code === 'ECONNABORTED') {
      type = 'timeout';
      retryable = true;
    } else if (axiosError.code === 'NETWORK_ERROR') {
      type = 'network';
      retryable = true;
    }

    return {
      type,
      message: axiosError.response?.data?.message || axiosError.message || 'Network error',
      context: {
        timestamp,
        userAgent: navigator.userAgent,
      },
      retryable,
      maxRetries: retryable ? 3 : undefined,
    };
  }

  // Handle standard errors
  if (error instanceof Error) {
    return {
      type: 'unknown',
      message: error.message,
      context: {
        timestamp,
        userAgent: navigator.userAgent,
      },
      retryable: false,
    };
  }

  // Handle unknown errors
  return {
    type: 'unknown',
    message: 'An unexpected error occurred',
    context: {
      timestamp,
      userAgent: navigator.userAgent,
    },
    retryable: false,
  };
};

// Error reporting utility
export const reportError = (error: AppError) => {
  // In development, log to console
  if (import.meta.env.DEV) {
    console.error('App Error:', error);
  }

  // In production, send to error tracking service
  if (import.meta.env.PROD) {
    // TODO: Integrate with Sentry, LogRocket, etc.
    // Example: Sentry.captureException(error);
  }
};