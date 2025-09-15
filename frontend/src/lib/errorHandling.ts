import toast from "react-hot-toast";
import { type AxiosError } from "axios";

// Error retry logic for API calls
export const shouldRetry = (error: AxiosError | unknown): boolean => {
  // Don't retry on 4xx client errors (except 408, 429)
  if ((error as AxiosError)?.response?.status >= 400 && (error as AxiosError)?.response?.status < 500) {
    return err.response?.status === 408 || err.response?.status === 429;
  }

  // Retry on 5xx server errors and network errors
  return (error as AxiosError)?.response?.status >= 500 || !(error as AxiosError)?.response;
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
  const message = (error as AxiosError)?.response?.data?.message ||
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
