const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"

export const WS_BASE_URL = API_URL.replace(/^http/, "ws")

export function getWsUrl(path: string): string {
  return `${WS_BASE_URL}${path}`
}
