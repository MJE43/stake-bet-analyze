import axios from "axios";
import { normalizeError, reportError } from "@/lib/errorModel";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// Type definitions
export type DebugInfo = Partial<{
  apiUrl: string;
  method: string;
  requestTime: number;
  responseTime?: number;
  responseStatus?: number;
  responseData?: Record<string, unknown>;
  requestData?: Record<string, unknown>;
  errors?: string[];
}>;

export type APIError = {
  message: string;
  status?: number;
  details: {
    originalError: string;
    code?: string;
    response?: Record<string, unknown>;
    config: {
      url?: string;
      method?: string;
      params?: Record<string, unknown>;
    };
  };
  timestamp: string;
  type: string;
};

// Extend axios config to include metadata for debugging
declare module 'axios' {
  interface AxiosRequestConfig {
    metadata?: {
      debugInfo: DebugInfo;
    };
  }
}

// Enhanced API client with debugging and timeout configuration
export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000, // 10 second timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for debugging
apiClient.interceptors.request.use(
  (config) => {
    const debugInfo = {
      apiUrl: `${config.baseURL}${config.url}`,
      method: config.method?.toUpperCase() || 'GET',
      requestTime: Date.now(),
      requestData: config.data,
    };

    // Store debug info in request config for later use
    config.metadata = { debugInfo };

    if (import.meta.env.DEV) {
      console.group(`🚀 API Request: ${debugInfo.method} ${debugInfo.apiUrl}`);
      console.log('Request Config:', {
        url: config.url,
        method: config.method,
        params: config.params,
        data: config.data,
        headers: config.headers,
        timeout: config.timeout,
      });
      console.log('Timestamp:', new Date().toISOString());
      console.groupEnd();
    }

    return config;
  },
  (error) => {
    if (import.meta.env.DEV) {
      console.error('❌ Request Setup Error:', error);
    }
    return Promise.reject(error);
  }
);

// Enhanced response interceptor with comprehensive error handling and logging
apiClient.interceptors.response.use(
  (response) => {
    const debugInfo = response.config.metadata?.debugInfo;
    const responseTime = Date.now();
    const duration = debugInfo?.requestTime
      ? responseTime - debugInfo.requestTime
      : 0;

    if (import.meta.env.DEV) {
      console.group(
        `✅ API Response: ${response.status} ${debugInfo?.method || "GET"} ${
          debugInfo?.apiUrl || response.config.url
        }`
      );
      console.log("Response Status:", response.status);
      console.log("Response Headers:", response.headers);
      console.log("Response Data:", response.data);
      console.log("Duration:", `${duration}ms`);
      console.log("Timestamp:", new Date().toISOString());
      console.groupEnd();
    }

    return response;
  },
  (error) => {
    const debugInfo = error.config?.metadata?.debugInfo;
    const responseTime = Date.now();
    const duration = debugInfo?.requestTime
      ? responseTime - debugInfo.requestTime
      : 0;

    // Categorize error types
    let errorType: 'network' | 'http' | 'timeout' | 'unknown' = "unknown";
    let userMessage = "An unexpected error occurred";

    if (error.code === "ECONNABORTED" || error.code === "TIMEOUT") {
      errorType = "timeout";
      userMessage =
        "Request timed out. Please check your connection and try again.";
    } else if (error.code === "NETWORK_ERROR" || error.code === "ERR_NETWORK") {
      errorType = "network";
      userMessage =
        "Network connection failed. Please check your internet connection.";
    } else if (error.response) {
      errorType = "http";

      // Handle specific HTTP status codes
      switch (error.response.status) {
        case 404:
          userMessage =
            "Resource not found. The requested item may have been deleted.";
          break;
        case 400:
          userMessage =
            error.response.data?.error?.message ||
            "Invalid request. Please check your input.";
          break;
        case 401:
          userMessage = "Authentication required. Please log in again.";
          break;
        case 403:
          userMessage =
            "Access denied. You do not have permission to perform this action.";
          break;
        case 429:
          userMessage =
            "Too many requests. Please wait a moment and try again.";
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          userMessage = "Server error. Please try again later.";
          break;
        default:
          userMessage =
            error.response.data?.error?.message ||
            `Server returned error ${error.response.status}`;
      }
    }

    // Create structured error object
    const apiError = {
      message: userMessage,
      status: error.response?.status,
      details: {
        originalError: error.message,
        code: error.code,
        response: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          params: error.config?.params,
        },
      },
      timestamp: new Date().toISOString(),
      type: errorType,
    };

    if (import.meta.env.DEV) {
      console.group(
        `❌ API Error: ${error.response?.status || error.code} ${
          debugInfo?.method || "GET"
        } ${debugInfo?.apiUrl || error.config?.url}`
      );
      console.error("Error Type:", errorType);
      console.error("Status:", error.response?.status);
      console.error("Message:", userMessage);
      console.error("Original Error:", error.message);
      console.error("Response Data:", error.response?.data);
      console.error("Request Config:", {
        url: error.config?.url,
        method: error.config?.method,
        params: error.config?.params,
        data: error.config?.data,
      });
      console.error("Duration:", `${duration}ms`);
      console.error("Timestamp:", apiError.timestamp);
      console.groupEnd();
    }

    // Report error
    reportError(normalizeError(error));

    // Throw user-friendly error
    const enhancedError = new Error(userMessage) as Error & { apiError: { message: string; status?: number; details?: Record<string, unknown>; timestamp: string; type: string } };
    enhancedError.apiError = apiError;
    throw enhancedError;
  }
);

// Utility function to test API connectivity
export const testApiConnection = async (): Promise<{
  success: boolean;
  error?: string;
  responseTime?: number;
}> => {
  const startTime = Date.now();

  try {
    // Test with a simple endpoint - using runs list with limit 1
    await apiClient.get("/runs", { params: { limit: 1 } });
    const responseTime = Date.now() - startTime;

    return {
      success: true,
      responseTime,
    };
  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      responseTime,
    };
  }
};

// Utility function to get detailed error information
export const getErrorDetails = (error: unknown) => {
  return (error as Error & { apiError?: { message: string; status?: number; details?: Record<string, unknown>; timestamp: string; type: string } })?.apiError || null;
};