import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react"
import type { Thread, ThreadStatus } from "@/api/workspaces"

export interface TabThread {
  id: number
  workspaceId: number
  name: string
  status: ThreadStatus
  terminals: number[]
  activeTerminalId: number
  nextTerminalId: number
}

interface ThreadTabsState {
  tabs: TabThread[]
  activeTabId: number | null
  openTab: (thread: Thread) => void
  closeTab: (threadId: number) => void
  setActiveTab: (threadId: number) => void
  updateTabStatus: (threadId: number, status: ThreadStatus) => void
  addTerminal: (threadId: number) => void
  removeTerminal: (threadId: number, terminalId: number) => void
  setActiveTerminal: (threadId: number, terminalId: number) => void
}

const STORAGE_KEY = "ram-thread-tabs"

interface PersistedState {
  tabs: TabThread[]
  activeTabId: number | null
}

function loadPersistedState(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { tabs: [], activeTabId: null }
    const parsed = JSON.parse(raw) as PersistedState
    // Reset statuses to idle on reload (will be updated by terminal connections)
    const tabs = parsed.tabs.map((t) => ({ ...t, status: "idle" as ThreadStatus }))
    return { tabs, activeTabId: parsed.activeTabId }
  } catch {
    return { tabs: [], activeTabId: null }
  }
}

const ThreadTabsContext = createContext<ThreadTabsState | null>(null)

export function ThreadTabsProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<TabThread[]>(() => loadPersistedState().tabs)
  const [activeTabId, setActiveTabId] = useState<number | null>(
    () => loadPersistedState().activeTabId
  )
  const tabsRef = useRef(tabs)
  const activeTabIdRef = useRef(activeTabId)

  // Keep refs in sync for persistence
  useEffect(() => {
    tabsRef.current = tabs
    activeTabIdRef.current = activeTabId
  }, [tabs, activeTabId])

  // Persist on change
  useEffect(() => {
    const state: PersistedState = { tabs, activeTabId }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [tabs, activeTabId])

  const openTab = useCallback((thread: Thread) => {
    setTabs((prev) => {
      if (prev.find((t) => t.id === thread.id)) return prev
      return [
        ...prev,
        {
          id: thread.id,
          workspaceId: thread.workspaceId,
          name: thread.name,
          status: thread.status,
          terminals: [0],
          activeTerminalId: 0,
          nextTerminalId: 1,
        },
      ]
    })
    setActiveTabId(thread.id)
  }, [])

  const closeTab = useCallback((threadId: number) => {
    setTabs((prev) => prev.filter((t) => t.id !== threadId))
    setActiveTabId((prev) => {
      if (prev !== threadId) return prev
      const currentTabs = tabsRef.current
      const idx = currentTabs.findIndex((t) => t.id === threadId)
      const neighbor = currentTabs[idx - 1] || currentTabs[idx + 1]
      return neighbor?.id ?? null
    })
  }, [])

  const setActiveTab = useCallback((threadId: number) => {
    setActiveTabId(threadId)
  }, [])

  const updateTabStatus = useCallback((threadId: number, status: ThreadStatus) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, status } : t))
    )
  }, [])

  const addTerminal = useCallback((threadId: number) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t
        const newId = t.nextTerminalId
        return {
          ...t,
          terminals: [...t.terminals, newId],
          activeTerminalId: newId,
          nextTerminalId: newId + 1,
        }
      })
    )
  }, [])

  const removeTerminal = useCallback((threadId: number, terminalId: number) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t
        const next = t.terminals.filter((id) => id !== terminalId)
        if (next.length === 0) return t
        const activeTerminalId =
          t.activeTerminalId === terminalId
            ? next[Math.max(0, t.terminals.indexOf(terminalId) - 1)]
            : t.activeTerminalId
        return { ...t, terminals: next, activeTerminalId }
      })
    )
  }, [])

  const setActiveTerminal = useCallback((threadId: number, terminalId: number) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === threadId ? { ...t, activeTerminalId: terminalId } : t
      )
    )
  }, [])

  return (
    <ThreadTabsContext.Provider
      value={{
        tabs,
        activeTabId,
        openTab,
        closeTab,
        setActiveTab,
        updateTabStatus,
        addTerminal,
        removeTerminal,
        setActiveTerminal,
      }}
    >
      {children}
    </ThreadTabsContext.Provider>
  )
}

export function useThreadTabs() {
  const ctx = useContext(ThreadTabsContext)
  if (!ctx) throw new Error("useThreadTabs must be used within ThreadTabsProvider")
  return ctx
}
