import { useState, useCallback, useRef } from "react"
import useWebSocket from "react-use-websocket"
import { getWsUrl } from "@/lib/ws"

export type CloneLog = {
  type: "log" | "error" | "complete"
  message: string
  repoName?: string
  path?: string
}

export type CloneStatus = "idle" | "cloning" | "complete" | "error"

export function useCloneRepo() {
  const [logs, setLogs] = useState<CloneLog[]>([])
  const [status, setStatus] = useState<CloneStatus>("idle")
  const [shouldConnect, setShouldConnect] = useState(false)
  const pendingPayload = useRef<{ repoUrl: string; token?: string } | null>(
    null,
  )

  const { sendJsonMessage } = useWebSocket(
    getWsUrl("/ws/clone"),
    {
      onOpen: () => {
        if (pendingPayload.current) {
          sendJsonMessage(pendingPayload.current)
          pendingPayload.current = null
        }
      },
      onMessage: (event) => {
        const data = JSON.parse(event.data) as CloneLog
        setLogs((prev) => [...prev, data])

        if (data.type === "complete") {
          setStatus("complete")
          setShouldConnect(false)
        } else if (data.type === "error") {
          setStatus("error")
        }
      },
      onError: () => {
        setLogs((prev) => [
          ...prev,
          { type: "error", message: "WebSocket connection failed" },
        ])
        setStatus("error")
      },
      shouldReconnect: () => false,
    },
    shouldConnect,
  )

  const clone = useCallback((repoUrl: string, token?: string) => {
    setLogs([])
    setStatus("cloning")
    pendingPayload.current = { repoUrl, token: token || undefined }
    setShouldConnect(true)
  }, [])

  const reset = useCallback(() => {
    setShouldConnect(false)
    pendingPayload.current = null
    setLogs([])
    setStatus("idle")
  }, [])

  return { logs, status, clone, reset }
}
