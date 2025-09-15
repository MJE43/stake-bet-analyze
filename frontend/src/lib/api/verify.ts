import { apiClient } from "./client";

export const verifyApi = {
  verify: (params: {
    server_seed: string;
    client_seed: string;
    nonce: number;
    difficulty: string;
  }) => apiClient.get("/verify", { params }),
};