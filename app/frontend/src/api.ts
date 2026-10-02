import type {
  AuthConfig,
  DashboardItem,
  DashboardResponse,
  MessageResponse,
  TokenResponse,
  UserProfile,
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://api.farmwith.in";

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }
  if (response.status === 204) {
    return null as T;
  }
  return (await response.json()) as T;
}

export async function register(data: {
  name: string;
  email: string;
  password: string;
  phone_number: string;
  company_name?: string;
}): Promise<MessageResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<MessageResponse>(response);
}

export async function login(data: { email: string; password: string; remember: boolean }): Promise<TokenResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<TokenResponse>(response);
}

export async function forgotPassword(email: string): Promise<MessageResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/forgot`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse<MessageResponse>(response);
}

export async function verifyEmail(token: string): Promise<MessageResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`);
  return handleResponse<MessageResponse>(response);
}

export async function resendVerification(email: string): Promise<MessageResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse<MessageResponse>(response);
}

export async function fetchConfig(): Promise<AuthConfig> {
  const response = await fetch(`${API_BASE_URL}/auth/config`);
  return handleResponse<AuthConfig>(response);
}

export async function fetchProfile(token: string): Promise<UserProfile> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<UserProfile>(response);
}

export function getSsoLoginUrl() {
  return `${API_BASE_URL}/auth/sso/login`;
}

export async function submitContribution(
  payload: {
    site_id?: string;
    site_name?: string;
    idea_id?: string;
    idea_title?: string;
    name: string;
    contact: string;
    contribution_type: string;
    pledge_amount?: number;
    note?: string;
  },
  token: string,
): Promise<MessageResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const response = await fetch(`${API_BASE_URL}/contributions/`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  return handleResponse<MessageResponse>(response);
}

export async function fetchDashboard(token: string): Promise<DashboardResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/me/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<DashboardResponse>(response);
}

export async function fetchAdminDashboard(token: string): Promise<DashboardResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/me/dashboard/admin`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return handleResponse<DashboardResponse>(response);
}

export async function topUpDashboardItem(
  itemId: string,
  payload: { amount: number; note?: string },
  token: string,
): Promise<DashboardItem> {
  const response = await fetch(`${API_BASE_URL}/auth/me/dashboard/items/${itemId}/top-up`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<DashboardItem>(response);
}

export async function continueDashboardItem(
  itemId: string,
  payload: { note?: string },
  token: string,
): Promise<DashboardItem> {
  const response = await fetch(`${API_BASE_URL}/auth/me/dashboard/items/${itemId}/continue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<DashboardItem>(response);
}

export async function requestUpdateDashboardItem(
  itemId: string,
  payload: { note?: string },
  token: string,
): Promise<DashboardItem> {
  const response = await fetch(`${API_BASE_URL}/auth/me/dashboard/items/${itemId}/request-update`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  return handleResponse<DashboardItem>(response);
}
