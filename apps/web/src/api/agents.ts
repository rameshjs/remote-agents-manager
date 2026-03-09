import { api } from "@/lib/axios"

export interface Agent {
  id: number
  name: string
  status: "active" | "inactive" | "error"
  endpoint: string
  createdAt: string
  updatedAt: string
}

export interface CreateAgentPayload {
  name: string
  endpoint: string
}

export const agentsApi = {
  list: () => api.get<Agent[]>("/agents").then((r) => r.data),

  getById: (id: number) =>
    api.get<Agent>(`/agents/${id}`).then((r) => r.data),

  create: (payload: CreateAgentPayload) =>
    api.post<Agent>("/agents", payload).then((r) => r.data),
}
