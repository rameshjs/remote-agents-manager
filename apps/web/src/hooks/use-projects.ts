import { useQuery } from "@tanstack/react-query"
import { projectsApi } from "@/api/projects"

export function useProjects(enabled = true) {
  return useQuery({
    queryKey: ["projects"],
    queryFn: projectsApi.list,
    enabled,
    staleTime: 0,
  })
}
