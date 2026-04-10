import { request, BASE_URL } from "@/services/api";

export type InviteDetails = {
  company_name: string;
  role: string;
  email: string;
  masked_email: string;
  status: string;
  valid?: boolean;
};

export const inviteApi = {
  validate: (token: string) =>
    request<InviteDetails>(`/invite/${token}`, { retry: 1 }),

  accept: (token: string) =>
    request<{ accepted: boolean; company_id: string; role: string; message: string }>(
      `/invite/${token}/accept`,
      { method: "POST", retry: 0 }
    ),
};
