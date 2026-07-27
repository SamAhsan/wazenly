import axios from "axios";
import { getSession } from "next-auth/react";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api",
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use(async (config) => {
  const session = await getSession();
  if (session?.accessToken) {
    config.headers.Authorization = `Bearer ${session.accessToken}`;
  }
  // A caller can set x-workspace-id explicitly (e.g. an Owner inviting into a
  // different company than the one currently active) — only fall back to the
  // active company from sessionStorage when the call didn't already specify one.
  if (!config.headers["x-workspace-id"]) {
    const workspaceId = typeof window !== "undefined" ? sessionStorage.getItem("workspaceId") : null;
    if (workspaceId) {
      config.headers["x-workspace-id"] = workspaceId;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const code = error.response?.data?.error;
    if (typeof window !== "undefined") {
      if (code === "WORKSPACE_SUSPENDED" || code === "WORKSPACE_DELETED") {
        window.location.href = "/dashboard/suspended";
      } else if (code === "TOKEN_REVOKED" || code === "USER_SUSPENDED" || error.response?.status === 401) {
        window.location.href = "/auth/login";
      }
    }
    return Promise.reject(error);
  }
);

export { api };
export default api;
