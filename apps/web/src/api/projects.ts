import { api } from "@/lib/axios"

export interface Project {
  name: string
  path: string
}

export const projectsApi = {
  list: () => api.get<Project[]>("/projects").then((r) => r.data),
}
