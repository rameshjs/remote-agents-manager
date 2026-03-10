import { useState } from "react"
import { useThreadTabs, type TabThread } from "@/lib/thread-tabs"
import { RiCloseLine, RiLoader4Line, RiCheckboxCircleLine, RiErrorWarningLine, RiGitRepositoryLine } from "@remixicon/react"
import { cn } from "@/lib/utils"
import type { ThreadStatus } from "@/api/workspaces"
import { AddFromRepoDialog } from "@/components/add-from-repo-dialog"

function StatusIndicator({ status }: { status: ThreadStatus }) {
  switch (status) {
    case "running":
      return <RiLoader4Line className="size-3 animate-spin text-yellow-500" />
    case "completed":
      return <RiCheckboxCircleLine className="size-3 text-green-500" />
    case "error":
      return <RiErrorWarningLine className="size-3 text-red-500" />
    default:
      return null
  }
}

function TabItem({ tab, isActive }: { tab: TabThread; isActive: boolean }) {
  const { setActiveTab, closeTab } = useThreadTabs()

  return (
    <button
      onClick={() => setActiveTab(tab.id)}
      className={cn(
        "group relative flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-1.5 text-sm transition-colors",
        isActive
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      <StatusIndicator status={tab.status} />
      <span className="max-w-32 truncate">{tab.name}</span>
      <span
        role="button"
        onClick={(e) => {
          e.stopPropagation()
          closeTab(tab.id)
        }}
        className="ml-1 rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
      >
        <RiCloseLine className="size-3" />
      </span>
    </button>
  )
}

export function ThreadTabsBar() {
  const { tabs, activeTabId } = useThreadTabs()
  const [cloneOpen, setCloneOpen] = useState(false)

  return (
    <div className="flex items-end border-b bg-background">
      <div className="flex flex-1 items-end overflow-x-auto">
        {tabs.map((tab) => (
          <TabItem key={tab.id} tab={tab} isActive={tab.id === activeTabId} />
        ))}
      </div>
      <button
        onClick={() => setCloneOpen(true)}
        className="flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        title="Clone Repository"
      >
        <RiGitRepositoryLine className="size-3.5" />
        <span>Clone</span>
      </button>
      <AddFromRepoDialog open={cloneOpen} onOpenChange={setCloneOpen} />
    </div>
  )
}
