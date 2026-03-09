import { useMutation } from "@tanstack/react-query"
import { authApi, type LoginPayload } from "@/api/auth"

export function useLogin() {
  return useMutation({
    mutationFn: (payload: LoginPayload) => authApi.login(payload),
  })
}
