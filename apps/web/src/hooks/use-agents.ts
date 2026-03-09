import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { agentsApi, type CreateAgentPayload } from "@/api/agents"

const AGENTS_KEY = ["agents"] as const

export function useAgents() {
  return useQuery({
    queryKey: AGENTS_KEY,
    queryFn: agentsApi.list,
  })
}

export function useAgent(id: number) {
  return useQuery({
    queryKey: [...AGENTS_KEY, id],
    queryFn: () => agentsApi.getById(id),
    enabled: id > 0,
  })
}

export function useCreateAgent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateAgentPayload) => agentsApi.create(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: AGENTS_KEY }),
  })
}
