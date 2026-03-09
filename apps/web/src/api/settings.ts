import { api } from "@/lib/axios"

export interface Setting {
  key: string
  value: string | null
}

export const settingsApi = {
  get: (key: string) =>
    api.get<Setting>(`/settings/${key}`).then((r) => r.data),

  update: (key: string, value: string) =>
    api.put<Setting>(`/settings/${key}`, { value }).then((r) => r.data),
}
