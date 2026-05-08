/**
 * Hardened Central API client for LTC Fast Track backend
 */

const PROD_API_URL = "https://ltc-fast-track-fixed-production.up.railway.app";
const DEV_API_URL = "http://192.168.43.140:3000";

export function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;

  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.replace(/\/$/, "");
  }

  // FORCE CLOUD BACKEND FOR ALL DEVICES
  return "https://ltc-fast-track-fixed-production.up.railway.app";
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;

  console.log("[API REQUEST] =>", url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  let res: Response;

  try {
    res = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    console.error("[API TRANSPORT ERROR]", url, err);
    throw new Error(`Unable to reach backend server`);
  }

  clearTimeout(timer);

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message ?? body?.error ?? message;
    } catch {}
    console.error("[API RESPONSE ERROR]", url, message);
    throw new Error(message);
  }

  const text = await res.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    console.error("[API JSON PARSE ERROR]", url, text);
    throw new Error("Invalid server response");
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}