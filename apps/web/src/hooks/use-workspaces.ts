import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { workspacesApi, type CreateWorkspacePayload } from "@/api/workspaces"

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
