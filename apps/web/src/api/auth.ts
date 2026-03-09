import { api } from "@/lib/axios"

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
}

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<LoginResponse>("/auth/login", payload).then((r) => r.data),
}
