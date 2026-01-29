import type { ApiResponse } from "@/lib/types";

export function hasData<T>(result: ApiResponse<T> | null | undefined): result is ApiResponse<T> & { data: T } {
  return Boolean(result && result.data);
}

export function requireData<T>(result: ApiResponse<T> | null | undefined, message = "Response data is missing."): T {
  if (!result || !result.data) {
    throw new Error(message);
  }
  return result.data;
}

