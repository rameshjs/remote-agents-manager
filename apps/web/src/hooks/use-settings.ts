import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { settingsApi } from "@/api/settings"

const settingKey = (key: string) => ["settings", key] as const

export function useSetting(key: string, enabled = true) {
  return useQuery({
    queryKey: settingKey(key),
    queryFn: () => settingsApi.get(key),
    enabled,
  })
}

export function useUpdateSetting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      settingsApi.update(key, value),
    onSuccess: (_data, variables) =>
      qc.invalidateQueries({ queryKey: settingKey(variables.key) }),
  })
}
