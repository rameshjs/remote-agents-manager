import { api } from "@/lib/axios"

export interface Workspace {
  id: number
  name: string
  repoPath: string
  createdAt: string
}

export interface Thread {
  id: number
  workspaceId: number
  name: string
  branchName: string
  worktreePath: string
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

  update: (id: number, payload: { name: string }) =>
    api.patch<Workspace>(`/workspaces/${id}`, payload).then((r) => r.data),

  delete: (id: number) =>
    api.delete(`/workspaces/${id}`).then((r) => r.data),

  listThreads: (workspaceId: number) =>
    api.get<Thread[]>(`/workspaces/${workspaceId}/threads`).then((r) => r.data),

  createThread: (workspaceId: number, payload: { name: string }) =>
    api.post<Thread>(`/workspaces/${workspaceId}/threads`, payload).then((r) => r.data),

  deleteThread: (workspaceId: number, threadId: number) =>
    api.delete(`/workspaces/${workspaceId}/threads/${threadId}`).then((r) => r.data),
}
