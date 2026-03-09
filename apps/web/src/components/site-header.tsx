import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useThreadTabs } from "@/lib/thread-tabs"
import { RiLoader4Line, RiCheckboxCircleLine, RiErrorWarningLine } from "@remixicon/react"
import type { ThreadStatus } from "@/api/workspaces"

function StatusBadge({ status }: { status: ThreadStatus }) {
  switch (status) {
    case "running":
      return (
        <span className="flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-400">
          <RiLoader4Line className="size-3 animate-spin" />
          Running
        </span>
      )
    case "completed":
      return (
        <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-600 dark:text-green-400">
          <RiCheckboxCircleLine className="size-3" />
          Completed
        </span>
      )
    case "error":
      return (
        <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-600 dark:text-red-400">
          <RiErrorWarningLine className="size-3" />
          Error
        </span>
      )
    default:
      return null
  }
}

export function SiteHeader() {
  const { tabs, activeTabId } = useThreadTabs()
  const activeTab = tabs.find((t) => t.id === activeTabId)

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        {activeTab ? (
          <div className="flex items-center gap-2">
            <h1 className="text-base font-medium">{activeTab.name}</h1>
            <StatusBadge status={activeTab.status} />
          </div>
        ) : (
          <h1 className="text-base font-medium">Remote Agents</h1>
        )}
      </div>
    </header>
  )
}
