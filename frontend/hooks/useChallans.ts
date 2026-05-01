import useSWR from "swr";
import { API_URL } from "@/lib/api";
import type { ChallanDetail } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function useChallan(id: string) {
  const { data, error, isLoading, mutate } = useSWR<ChallanDetail>(
    id ? `${API_URL}/api/challans/${id}` : null,
    fetcher
  );
  return { challan: data, error, isLoading, mutate };
}
