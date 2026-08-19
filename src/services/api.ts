const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

interface User {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: "customer" | "admin" | "pharmacist";
  isActive: boolean;
  createdAt: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: User;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getToken(): string | null {
    return localStorage.getItem("kc_token");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) || {}),
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Something went wrong");
    }

    return data as T;
  }

  // ── Auth ──
  async register(payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (data.token) {
      localStorage.setItem("kc_token", data.token);
    }
    return data;
  }

  async login(payload: {
    email: string;
    password: string;
  }): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (data.token) {
      localStorage.setItem("kc_token", data.token);
    }
    return data;
  }

  async getMe(): Promise<{ success: boolean; user: User }> {
    return this.request<{ success: boolean; user: User }>("/auth/me");
  }

  async logout(): Promise<{ success: boolean; message: string }> {
    const data = await this.request<{ success: boolean; message: string }>(
      "/auth/logout",
      { method: "POST" }
    );
    localStorage.removeItem("kc_token");
    return data;
  }

  async updateProfile(payload: {
    name?: string;
    phone?: string;
  }): Promise<{ success: boolean; user: User }> {
    return this.request<{ success: boolean; user: User }>("/auth/profile", {
      method: "PUT",
      body: JSON.stringify(payload),
    });
  }

  // ── Health ──
  async healthCheck(): Promise<{ success: boolean; message: string }> {
    return this.request<{ success: boolean; message: string }>("/health");
  }
}

export const api = new ApiClient(API_BASE);
export type { User, AuthResponse };
