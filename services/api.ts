const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://aura-backend-production-f805.up.railway.app/api/v1";

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(path: string, opts: { method?: string; body?: unknown; token?: string | null } = {}): Promise<T> {
  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as any).error ?? `HTTP ${res.status}`, res.status);
  return data as T;
}

export type LoginResponse = {
  token: string;
  user: { id: string; name: string; email: string; role: string };
  company: { id: string; name: string; plan: string; onboarding_step: string } | null;
};

export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>("/auth/login", { method: "POST", body: { email, password } }),
  register: (body: { name: string; email: string; password: string; company_name: string }) =>
    request<LoginResponse>("/auth/register", { method: "POST", body }),
  me: (token: string) =>
    request<Omit<LoginResponse, "token">>("/auth/me", { method: "POST", token }),
};

export const dashboardApi = {
  summary: (companyId: string, token: string) =>
    request<any>(`/companies/${companyId}/withdrawal/summary`, { token }),
};

export { request };
