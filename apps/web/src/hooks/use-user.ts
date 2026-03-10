import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/axios"

export interface User {
  id: number
  email: string
}

export function useUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<User>("/me").then((r) => r.data),
  })
}
