import { api } from "@/lib/axios"

export interface Workspace {
  id: number
  name: string
  repoPath: string
  createdAt: string
}

export interface CreateWorkspacePayload {
  name: string
  repoPath: string
}

export const workspacesApi = {
  list: () => api.get<Workspace[]>("/workspaces").then((r) => r.data),

  create: (payload: CreateWorkspacePayload) =>
    api.post<Workspace>("/workspaces", payload).then((r) => r.data),

  delete: (id: number) =>
    api.delete(`/workspaces/${id}`).then((r) => r.data),
}
