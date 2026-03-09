import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { workspacesApi, type CreateWorkspacePayload, type FileNode } from "@/api/workspaces"

export function useWorkspaces() {
  return useQuery({
    queryKey: ["workspaces"],
    queryFn: workspacesApi.list,
  })
}

export function useCreateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateWorkspacePayload) =>
      workspacesApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  })
}

export function useUpdateWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) =>
      workspacesApi.update(id, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  })
}

export function useDeleteWorkspace() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => workspacesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  })
}

export function useThreads(workspaceId: number | null) {
  return useQuery({
    queryKey: ["threads", workspaceId],
    queryFn: () => workspacesApi.listThreads(workspaceId!),
    enabled: workspaceId !== null,
  })
}

export function useCreateThread() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workspaceId, name }: { workspaceId: number; name: string }) =>
      workspacesApi.createThread(workspaceId, { name }),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["threads", vars.workspaceId] }),
  })
}

export function useDeleteThread() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ workspaceId, threadId }: { workspaceId: number; threadId: number }) =>
      workspacesApi.deleteThread(workspaceId, threadId),
    onSuccess: (_data, vars) =>
      qc.invalidateQueries({ queryKey: ["threads", vars.workspaceId] }),
  })
}

export function usePullWorkspace() {
  return useMutation({
    mutationFn: (workspaceId: number) => workspacesApi.pull(workspaceId),
  })
}

export function useThreadDiff(workspaceId: number | null, threadId: number | null) {
  return useQuery({
    queryKey: ["thread-diff", workspaceId, threadId],
    queryFn: () => workspacesApi.threadDiff(workspaceId!, threadId!),
    enabled: workspaceId !== null && threadId !== null,
  })
}

export function useThreadFiles(workspaceId: number | null, threadId: number | null) {
  return useQuery({
    queryKey: ["thread-files", workspaceId, threadId],
    queryFn: () => workspacesApi.threadFiles(workspaceId!, threadId!),
    enabled: workspaceId !== null && threadId !== null,
  })
}

export function useThreadFileContent(
  workspaceId: number | null,
  threadId: number | null,
  path: string | null
) {
  return useQuery({
    queryKey: ["thread-file-content", workspaceId, threadId, path],
    queryFn: () => workspacesApi.threadFileContent(workspaceId!, threadId!, path!),
    enabled: workspaceId !== null && threadId !== null && path !== null,
  })
}
