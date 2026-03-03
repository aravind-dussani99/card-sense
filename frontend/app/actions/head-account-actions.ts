import { apiFetch } from "@/lib/api";
import { ApiResponse } from "@/lib/types";

export type HeadAccount = {
  id: string;
  name: string;
};

export async function getHeadAccounts() {
  return apiFetch<HeadAccount[]>("/api/head-accounts");
}

export async function addHeadAccount(name: string) {
  return apiFetch<ApiResponse<HeadAccount>>("/api/head-accounts", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export async function updateHeadAccount(id: string, name: string) {
  return apiFetch<ApiResponse<HeadAccount>>(`/api/head-accounts/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  });
}

export async function deleteHeadAccount(id: string) {
  return apiFetch<ApiResponse<void>>(`/api/head-accounts/${id}`, {
    method: "DELETE",
    skipJson: true,
  });
}
