import toast from "react-hot-toast";
import { type AxiosError } from "axios";

// Error retry logic for API calls
export const shouldRetry = (error: AxiosError | unknown): boolean => {
  const axiosError = error as AxiosError;
  const status = axiosError?.response?.status;

  // Don't retry on 4xx client errors (except 408, 429)
  if (status && status >= 400 && status < 500) {
    return status === 408 || status === 429;
  }

  // Retry on 5xx server errors and network errors
  return (status && status >= 500) || !axiosError?.response;
};

// Success toast with consistent styling
export const showSuccessToast = (message: string) => {
  toast.success(message, {
    style: {
      background: '#1e293b',
      color: '#f1f5f9',
      border: '1px solid #10b981',
    },
    iconTheme: {
      primary: '#10b981',
      secondary: '#1e293b',
    },
  });
};

// Error toast with consistent styling
export const showErrorToast = (error: AxiosError | unknown, fallbackMessage?: string) => {
  const axiosError = error as AxiosError;
  const message = (axiosError?.response?.data as { message?: string })?.message ||
                  (error as Error)?.message ||
                  fallbackMessage ||
                  'An error occurred';

  toast.error(message, {
    style: {
      background: '#1e293b',
      color: '#f1f5f9',
      border: '1px solid #ef4444',
    },
    iconTheme: {
      primary: '#ef4444',
      secondary: '#1e293b',
    },
  });
};
