import { useEffect, useRef, useCallback } from "react"
import { Terminal as XTerm } from "@xterm/xterm"
import { FitAddon } from "@xterm/addon-fit"
import "@xterm/xterm/css/xterm.css"
import { getWsUrl } from "@/lib/ws"
import { useThreadTabs } from "@/lib/thread-tabs"

interface TerminalProps {
  threadId: number
  terminalId: number
  isVisible: boolean
}

export function Terminal({ threadId, terminalId, isVisible }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { updateTabStatus } = useThreadTabs()

  const IDLE_TIMEOUT = 2000

  const markActive = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    updateTabStatus(threadId, "running")
    idleTimerRef.current = setTimeout(() => {
      updateTabStatus(threadId, "idle")
    }, IDLE_TIMEOUT)
  }, [threadId, updateTabStatus])

  const connect = useCallback(() => {
    if (!containerRef.current) return

    // Clean up previous instances
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (termRef.current) {
      termRef.current.dispose()
      termRef.current = null
    }

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      scrollback: 10000,
      fontFamily: "'DM Mono', 'Cascadia Code', 'Fira Code', monospace",
      theme: {
        background: "#09090b",
        foreground: "#fafafa",
        cursor: "#fafafa",
        selectionBackground: "#27272a",
      },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(containerRef.current)

    termRef.current = term
    fitAddonRef.current = fitAddon

    // Connect WebSocket
    const ws = new WebSocket(getWsUrl(`/ws/terminal/${threadId}/${terminalId}`))
    wsRef.current = ws

    ws.onopen = () => {
      // Send initial size
      ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === "output") {
          term.write(msg.data)
          markActive()
        } else if (msg.type === "exit") {
          if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
          updateTabStatus(threadId, msg.code === 0 ? "completed" : "error")
          term.writeln(`\r\n\x1b[90m[Process exited with code ${msg.code}]\x1b[0m`)
        } else if (msg.type === "error") {
          term.writeln(`\r\n\x1b[31m${msg.message}\x1b[0m`)
        }
      } catch {
        // Not JSON, write raw
        term.write(event.data)
      }
    }

    ws.onclose = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      term.writeln("\r\n\x1b[90m[Connection closed]\x1b[0m")
    }

    // Send terminal input to WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "input", data }))
      }
    })

    // Handle resize
    term.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }))
      }
    })
  }, [threadId, terminalId, updateTabStatus, markActive])

  useEffect(() => {
    connect()

    // ResizeObserver is the single authority on terminal fitting.
    // It fires on initial observation and on every subsequent size change.
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        fitAddonRef.current?.fit()
      }
    })
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }

    return () => {
      observer.disconnect()
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
      wsRef.current?.close()
      termRef.current?.dispose()
    }
  }, [connect])

  // Re-fit when this terminal becomes visible (tab/sub-tab switch)
  useEffect(() => {
    if (isVisible && containerRef.current) {
      const { clientWidth, clientHeight } = containerRef.current
      if (clientWidth > 0 && clientHeight > 0) {
        fitAddonRef.current?.fit()
      }
      termRef.current?.focus()
    }
  }, [isVisible])

  return <div ref={containerRef} className="absolute inset-0 overflow-hidden" />
}
