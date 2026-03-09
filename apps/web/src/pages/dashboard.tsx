import { RiChat3Line, RiAddLine, RiCloseLine, RiTerminalLine } from "@remixicon/react"
import { useThreadTabs, type TabThread } from "@/lib/thread-tabs"
import { Terminal } from "@/components/terminal"
import { ThreadTabsBar } from "@/components/thread-tabs-bar"
import { cn } from "@/lib/utils"

function TerminalGroup({ tab, isTabVisible }: { tab: TabThread; isTabVisible: boolean }) {
  const { addTerminal, removeTerminal, setActiveTerminal } = useThreadTabs()

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 relative min-h-0">
        {tab.terminals.map((terminalId) => (
          <div
            key={terminalId}
            className={
              terminalId === tab.activeTerminalId
                ? "absolute inset-0"
                : "absolute inset-0 invisible"
            }
          >
            <Terminal
              threadId={tab.id}
              terminalId={terminalId}
              isVisible={isTabVisible && terminalId === tab.activeTerminalId}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center border-t border-border bg-[#09090b]">
        {tab.terminals.map((terminalId, i) => (
          <button
            key={terminalId}
            onClick={() => setActiveTerminal(tab.id, terminalId)}
            className={cn(
              "group flex items-center gap-1.5 px-3 py-1 text-xs transition-colors",
              terminalId === tab.activeTerminalId
                ? "bg-zinc-800 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <RiTerminalLine className="size-3" />
            <span>{i + 1}</span>
            {tab.terminals.length > 1 && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeTerminal(tab.id, terminalId)
                }}
                className="rounded-sm p-0.5 opacity-0 transition-opacity hover:bg-zinc-700 group-hover:opacity-100"
              >
                <RiCloseLine className="size-3" />
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => addTerminal(tab.id)}
          className="flex items-center px-2 py-1 text-zinc-500 transition-colors hover:text-zinc-300"
          title="Add terminal"
        >
          <RiAddLine className="size-3.5" />
        </button>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { tabs, activeTabId } = useThreadTabs()

  return (
    <>
      <ThreadTabsBar />
      {tabs.length === 0 || activeTabId === null ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-4 text-center text-muted-foreground">
            <RiChat3Line className="size-12" />
            <div>
              <p className="text-lg font-medium">No thread selected</p>
              <p className="text-sm">
                Select a thread from a workspace to continue
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={
                tab.id === activeTabId
                  ? "absolute inset-0"
                  : "absolute inset-0 invisible"
              }
            >
              <TerminalGroup tab={tab} isTabVisible={tab.id === activeTabId} />
            </div>
          ))}
        </div>
      )}
    </>
  )
}
