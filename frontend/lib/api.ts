import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ---------- Types ----------
export interface Dataset {
  id: string;
  filename: string;
  file_size_bytes: number;
  n_rows: number;
  n_columns: number;
  target_column: string;
  column_schema?: Record<string, string>;
  missing_value_count: number;
  duplicate_row_count: number;
  created_at: string;
}

export interface MLModel {
  id: string;
  name: string;
  description: string | null;
  framework: string;
  version: number;
  task_type: "classification" | "regression";
  metrics: Record<string, number>;
  feature_columns: string[];
  tags: string[];
  is_bookmarked: boolean;
  file_size_bytes: number;
  created_at: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface ActivityItem {
  id: string;
  action: string;
  description: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface TrainingJobStatus {
  job_id: string;
  status: "queued" | "running" | "completed" | "failed";
  model_id?: string;
  metrics?: Record<string, number>;
  version?: number;
  error_message?: string;
}

// ---------- Auth ----------
export async function login(email: string, password: string) {
  const form = new URLSearchParams();
  form.append("username", email);
  form.append("password", password);
  const { data } = await api.post("/api/auth/login", form, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  localStorage.setItem("access_token", data.access_token);
  return data;
}

export async function register(email: string, password: string, displayName?: string) {
  const { data } = await api.post("/api/auth/register", {
    email, password, display_name: displayName,
  });
  localStorage.setItem("access_token", data.access_token);
  return data;
}

export async function getProfile() {
  const { data } = await api.get("/api/auth/me");
  return data;
}

export async function updateProfile(displayName: string) {
  const { data } = await api.put("/api/auth/me", { display_name: displayName });
  return data;
}

// ---------- Datasets ----------
export async function uploadDataset(file: File, targetColumn: string): Promise<Dataset> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post(
    `/api/datasets/upload?target_column=${encodeURIComponent(targetColumn)}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return data;
}

export async function listDatasets(page = 1, search = ""): Promise<Paginated<Dataset>> {
  const { data } = await api.get("/api/datasets", { params: { page, search: search || undefined } });
  return data;
}

export async function previewDataset(datasetId: string) {
  const { data } = await api.get(`/api/datasets/${datasetId}/preview`);
  return data as { columns: string[]; rows: Record<string, unknown>[] };
}

export async function deleteDataset(datasetId: string) {
  await api.delete(`/api/datasets/${datasetId}`);
}

// ---------- Training ----------
export async function startTraining(
  datasetId: string,
  taskType: "classification" | "regression",
  algorithm: string,
  modelName: string,
  priority = 5
) {
  const { data } = await api.post("/api/training", {
    dataset_id: datasetId, task_type: taskType, algorithm, model_name: modelName, priority,
  });
  return data as { job_id: string; status: string; queue_position: number };
}

export async function getJobStatus(jobId: string): Promise<TrainingJobStatus> {
  const { data } = await api.get(`/api/training/${jobId}`);
  return data;
}

// ---------- Models ----------
export async function listModels(page = 1, search = "", bookmarkedOnly = false): Promise<Paginated<MLModel>> {
  const { data } = await api.get("/api/models", {
    params: { page, search: search || undefined, bookmarked_only: bookmarkedOnly || undefined },
  });
  return data;
}

export async function getModel(modelId: string): Promise<MLModel> {
  const { data } = await api.get(`/api/models/${modelId}`);
  return data;
}

export async function getVersionHistory(modelId: string): Promise<MLModel[]> {
  const { data } = await api.get(`/api/models/${modelId}/versions`);
  return data;
}

export async function compareModels(ids: string[]): Promise<MLModel[]> {
  const { data } = await api.get("/api/models/compare", { params: { ids: ids.join(",") } });
  return data;
}

export async function updateModel(modelId: string, body: { description?: string; tags?: string[] }) {
  const { data } = await api.put(`/api/models/${modelId}`, body);
  return data;
}

export async function toggleBookmark(modelId: string) {
  const { data } = await api.post(`/api/models/${modelId}/bookmark`);
  return data as { is_bookmarked: boolean };
}

export async function deleteModel(modelId: string) {
  await api.delete(`/api/models/${modelId}`);
}

export async function getModelAnalytics(modelId: string) {
  const { data } = await api.get(`/api/models/${modelId}/analytics`);
  return data;
}

// ---------- Predictions ----------
export async function predict(modelId: string, input: Record<string, unknown>) {
  const { data } = await api.post(`/api/predict/${modelId}`, { input });
  return data as { result: any; cache_hit: boolean; latency_ms: number };
}

export async function getPredictionHistory(modelId: string, page = 1) {
  const { data } = await api.get(`/api/predict/${modelId}/history`, { params: { page } });
  return data;
}

export function getExportUrl(modelId: string) {
  return `${API_BASE_URL}/api/predict/${modelId}/history/export`;
}

// ---------- Activity ----------
export async function listActivity(page = 1): Promise<Paginated<ActivityItem>> {
  const { data } = await api.get("/api/activity", { params: { page } });
  return data;
}

// ---------- Search ----------
export async function globalSearch(query: string) {
  const { data } = await api.get("/api/search", { params: { q: query } });
  return data as { query: string; results: { id: string; type: string; name: string }[] };
}

// ---------- Dashboard ----------
export async function getDashboardSummary() {
  const { data } = await api.get("/api/dashboard/summary");
  return data;
}

export async function getPredictionsPerDay(days = 14) {
  const { data } = await api.get("/api/dashboard/predictions-per-day", { params: { days } });
  return data as { date: string; count: number }[];
}

export async function getModelUsage() {
  const { data } = await api.get("/api/dashboard/model-usage");
  return data as { model_name: string; prediction_count: number }[];
}
