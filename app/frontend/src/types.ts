export interface AuthConfig {
  enable_sso: boolean;
  oidc_provider_name: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  role?: string;
  name?: string;
  phone_number?: string;
  company_name?: string;
}

export interface MessageResponse {
  detail: string;
}

export interface DashboardSummary {
  active_items: number;
  funding_items: number;
  support_items: number;
  open_items: number;
  total_pledged: string;
}

export interface DashboardEvent {
  id: string;
  project_title: string;
  event_type: string;
  summary: string;
  amount_delta?: string | null;
  created_at: string;
}

export interface DashboardItem {
  id: string;
  site_id: string;
  site_name: string;
  project_id?: string | null;
  project_title: string;
  kind: string;
  contribution_type: string;
  classification?: string | null;
  status: string;
  requested_amount?: string | null;
  accepted_amount?: string | null;
  currency: string;
  note?: string | null;
  latest_update?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardResponse {
  profile: UserProfile;
  summary: DashboardSummary;
  items: DashboardItem[];
  recent_events: DashboardEvent[];
}
