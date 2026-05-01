import axios from "axios";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const api = axios.create({ baseURL: API_URL });

export async function uploadChallan(formData: FormData) {
  const res = await api.post("/api/challans/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function fetchChallans() {
  const res = await api.get("/api/challans");
  return res.data;
}

export async function fetchChallan(id: string) {
  const res = await api.get(`/api/challans/${id}`);
  return res.data;
}

export async function deleteChallan(id: string) {
  const res = await api.delete(`/api/challans/${id}`);
  return res.data;
}

export async function updateChallanStatus(id: string, status: string) {
  const res = await api.patch(`/api/challans/${id}/status`, { status });
  return res.data;
}

export async function updateItemDelivered(challanId: string, itemId: string, delivered: boolean) {
  const res = await api.patch(`/api/challans/${challanId}/items/${itemId}/delivered`, { delivered });
  return res.data;
}

export async function batchUpdateItemsDelivered(
  challanId: string,
  updates: { item_id: string; delivered: boolean }[]
) {
  const res = await api.patch(`/api/challans/${challanId}/items/batch-delivered`, { updates });
  return res.data;
}

export async function reprocessImages(challanId: string) {
  const res = await api.post(`/api/challans/${challanId}/reprocess-images`);
  return res.data;
}
