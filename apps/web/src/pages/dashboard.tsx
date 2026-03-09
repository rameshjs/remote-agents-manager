import { useState, useEffect, useMemo } from "react"
import {
  RiChat3Line,
  RiAddLine,
  RiCloseLine,
  RiTerminalLine,
  RiGitCommitLine,
  RiFolderLine,
  RiArrowRightSLine,
  RiFileLine,
  RiRefreshLine,
  RiLoader4Line,
  RiArrowLeftSLine,
  RiAddCircleLine,
  RiDeleteBinLine,
  RiEditLine,
  RiFileEditLine,
} from "@remixicon/react"
import { useThreadTabs, type TabThread } from "@/lib/thread-tabs"
import { Terminal } from "@/components/terminal"
import { ThreadTabsBar } from "@/components/thread-tabs-bar"
import { cn } from "@/lib/utils"
import {
  useThreadDiff,
  useThreadFiles,
  useThreadFileContent,
} from "@/hooks/use-workspaces"
import type { FileNode } from "@/api/workspaces"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { parse as parseDiff } from "diff2html"
import type { DiffFile } from "diff2html/lib/types"
import "diff2html/bundles/css/diff2html.min.css"
import { codeToHtml } from "shiki"

// --- Status badge for git status codes ---

function statusLabel(code: string): { label: string; color: string } {
  const c = code.trim().charAt(0)
  switch (c) {
    case "M":
      return { label: "Modified", color: "text-yellow-400" }
    case "A":
      return { label: "Added", color: "text-green-400" }
    case "D":
      return { label: "Deleted", color: "text-red-400" }
    case "R":
      return { label: "Renamed", color: "text-blue-400" }
    case "?":
      return { label: "Untracked", color: "text-zinc-400" }
    default:
      return { label: code.trim(), color: "text-muted-foreground" }
  }
}

// --- Per-file diff item ---

function DiffFileItem({ file }: { file: DiffFile }) {
  const [expanded, setExpanded] = useState(true)

  const addedLines = file.addedLines
  const deletedLines = file.deletedLines
  const fileName = file.newName || file.oldName

  return (
    <div className="rounded-md border overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-muted/50 transition-colors"
      >
        <RiArrowRightSLine
          className={cn(
            "size-3.5 shrink-0 transition-transform",
            expanded && "rotate-90"
          )}
        />
        {file.isDeleted ? (
          <RiDeleteBinLine className="size-3.5 shrink-0 text-red-400" />
        ) : file.isNew ? (
          <RiAddCircleLine className="size-3.5 shrink-0 text-green-400" />
        ) : file.isRename ? (
          <RiEditLine className="size-3.5 shrink-0 text-blue-400" />
        ) : (
          <RiFileEditLine className="size-3.5 shrink-0 text-yellow-400" />
        )}
        <span className="truncate font-mono">{fileName}</span>
        <span className="ml-auto flex items-center gap-2 shrink-0">
          {addedLines > 0 && (
            <span className="text-green-400">+{addedLines}</span>
          )}
          {deletedLines > 0 && (
            <span className="text-red-400">-{deletedLines}</span>
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t overflow-auto">
          <pre className="text-xs leading-relaxed">
            {file.blocks.map((block: DiffFile["blocks"][number], bi: number) => (
              <div key={bi}>
                <div className="bg-blue-500/10 px-3 py-0.5 text-blue-400 sticky top-0">
                  {block.header}
                </div>
                {block.lines.map((line: DiffFile["blocks"][number]["lines"][number], li: number) => (
                  <div
                    key={li}
                    className={cn(
                      "px-3",
                      line.type === "insert"
                        ? "bg-green-500/10 text-green-400"
                        : line.type === "delete"
                          ? "bg-red-500/10 text-red-400"
                          : "text-muted-foreground"
                    )}
                  >
                    <span className="inline-block w-8 text-right mr-2 select-none opacity-50">
                      {line.type === "delete"
                        ? line.oldNumber
                        : line.type === "insert"
                          ? line.newNumber
                          : line.oldNumber}
                    </span>
                    {line.content}
                  </div>
                ))}
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  )
}

// --- Diff viewer with file list ---

function DiffView({ diff, status }: { diff: string; status: string }) {
  const parsedFiles = useMemo(
    () => (diff ? parseDiff(diff) : []),
    [diff]
  )

  // Parse status lines into a map
  const statusEntries = useMemo(() => {
    if (!status) return []
    return status
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const code = line.substring(0, 2)
        const filePath = line.substring(3).trim()
        return { code, filePath, ...statusLabel(code) }
      })
  }, [status])

  // Find untracked files (not in diff)
  const untrackedFiles = useMemo(() => {
    const diffPaths = new Set(
      parsedFiles.map((f) => f.newName || f.oldName)
    )
    return statusEntries.filter(
      (e) => e.code.includes("?") && !diffPaths.has(e.filePath)
    )
  }, [parsedFiles, statusEntries])

  if (parsedFiles.length === 0 && statusEntries.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
        No changes detected
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Summary */}
      <div className="flex items-center gap-3 px-1 text-xs text-muted-foreground">
        <span>
          {parsedFiles.length} file{parsedFiles.length !== 1 ? "s" : ""} changed
        </span>
        {statusEntries.length > 0 && (
          <span>{statusEntries.length} total in status</span>
        )}
      </div>

      {/* Status list */}
      {statusEntries.length > 0 && (
        <div className="rounded-md border p-2">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground px-1">
            Git Status
          </p>
          {statusEntries.map((entry, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-1 py-0.5 text-xs font-mono"
            >
              <span
                className={cn(
                  "shrink-0 rounded px-1 py-px text-[10px] font-semibold",
                  entry.color
                )}
              >
                {entry.code.trim()}
              </span>
              <span className="truncate">{entry.filePath}</span>
              <span className={cn("ml-auto shrink-0 text-[10px]", entry.color)}>
                {entry.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Per-file diffs */}
      {parsedFiles.map((file, i) => (
        <DiffFileItem key={i} file={file} />
      ))}

      {/* Untracked files without diff */}
      {untrackedFiles.length > 0 && (
        <div className="rounded-md border p-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground px-1">
            Untracked Files
          </p>
          {untrackedFiles.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-1 py-0.5 text-xs font-mono text-zinc-400"
            >
              <RiFileLine className="size-3 shrink-0" />
              <span className="truncate">{f.filePath}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- File content viewer with syntax highlighting ---

function FileContentViewer({
  tab,
  filePath,
  onBack,
}: {
  tab: TabThread
  filePath: string
  onBack: () => void
}) {
  const { data, isLoading } = useThreadFileContent(
    tab.workspaceId,
    tab.id,
    filePath
  )
  const [highlightedHtml, setHighlightedHtml] = useState<string>("")
  const [highlighting, setHighlighting] = useState(false)

  // Determine language from file extension
  const lang = useMemo(() => {
    const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
    const map: Record<string, string> = {
      ts: "typescript",
      tsx: "tsx",
      js: "javascript",
      jsx: "jsx",
      py: "python",
      rs: "rust",
      go: "go",
      rb: "ruby",
      java: "java",
      kt: "kotlin",
      swift: "swift",
      c: "c",
      cpp: "cpp",
      h: "c",
      hpp: "cpp",
      cs: "csharp",
      css: "css",
      scss: "scss",
      html: "html",
      vue: "vue",
      svelte: "svelte",
      json: "json",
      yaml: "yaml",
      yml: "yaml",
      toml: "toml",
      md: "markdown",
      mdx: "mdx",
      sql: "sql",
      sh: "bash",
      bash: "bash",
      zsh: "bash",
      dockerfile: "dockerfile",
      graphql: "graphql",
      xml: "xml",
      svg: "xml",
    }
    return map[ext] || "text"
  }, [filePath])

  useEffect(() => {
    if (!data?.content) {
      setHighlightedHtml("")
      return
    }

    let cancelled = false
    setHighlighting(true)

    codeToHtml(data.content, {
      lang,
      theme: "github-dark-default",
    })
      .then((html) => {
        if (!cancelled) setHighlightedHtml(html)
      })
      .catch(() => {
        // Fallback: render as plain text
        if (!cancelled) setHighlightedHtml("")
      })
      .finally(() => {
        if (!cancelled) setHighlighting(false)
      })

    return () => {
      cancelled = true
    }
  }, [data?.content, lang])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-2 py-1.5">
        <button
          onClick={onBack}
          className="rounded-sm p-0.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <RiArrowLeftSLine className="size-4" />
        </button>
        <RiFileLine className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs font-mono">{filePath}</span>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading || highlighting ? (
          <div className="flex items-center justify-center p-8">
            <RiLoader4Line className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : highlightedHtml ? (
          <div
            className="shiki-container text-xs [&_pre]:!bg-transparent [&_pre]:p-3 [&_code]:leading-relaxed"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : data?.content ? (
          <pre className="p-3 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
            {data.content}
          </pre>
        ) : (
          <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
            {data === undefined ? "File not found" : "Empty file"}
          </div>
        )}
      </div>
    </div>
  )
}

// --- File tree viewer ---

function FileTreeNode({
  node,
  depth = 0,
  onFileSelect,
}: {
  node: FileNode
  depth?: number
  onFileSelect: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(depth < 1)

  return (
    <div>
      <button
        onClick={() => {
          if (node.type === "directory") setExpanded(!expanded)
          else onFileSelect(node.path)
        }}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs hover:bg-muted transition-colors cursor-pointer"
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
      >
        {node.type === "directory" ? (
          <>
            <RiArrowRightSLine
              className={cn(
                "size-3 shrink-0 transition-transform",
                expanded && "rotate-90"
              )}
            />
            <RiFolderLine className="size-3 shrink-0 text-blue-400" />
          </>
        ) : (
          <>
            <span className="size-3 shrink-0" />
            <RiFileLine className="size-3 shrink-0 text-muted-foreground" />
          </>
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.type === "directory" &&
        expanded &&
        node.children?.map((child) => (
          <FileTreeNode
            key={child.path}
            node={child}
            depth={depth + 1}
            onFileSelect={onFileSelect}
          />
        ))}
    </div>
  )
}

function FileTreeView({
  files,
  onFileSelect,
}: {
  files: FileNode[]
  onFileSelect: (path: string) => void
}) {
  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
        No files found
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      {files.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          onFileSelect={onFileSelect}
        />
      ))}
    </div>
  )
}

// --- File preview sheet (separate 50% width drawer) ---

function FilePreviewSheet({
  tab,
  filePath,
  open,
  onOpenChange,
}: {
  tab: TabThread
  filePath: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-1/2 !max-w-none overflow-hidden flex flex-col"
        showCloseButton={false}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>File Preview</SheetTitle>
          <SheetDescription>Preview file contents</SheetDescription>
        </SheetHeader>
        {filePath && (
          <FileContentViewer
            tab={tab}
            filePath={filePath}
            onBack={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

// --- Thread info sheet ---

function ThreadInfoSheet({
  tab,
  open,
  onOpenChange,
  defaultTab,
}: {
  tab: TabThread
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultTab: string
}) {
  const [previewFile, setPreviewFile] = useState<string | null>(null)

  const {
    data: diffData,
    isLoading: diffLoading,
    refetch: refetchDiff,
  } = useThreadDiff(
    open ? tab.workspaceId : null,
    open ? tab.id : null
  )
  const {
    data: filesData,
    isLoading: filesLoading,
    refetch: refetchFiles,
  } = useThreadFiles(
    open ? tab.workspaceId : null,
    open ? tab.id : null
  )

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="sm:max-w-lg w-full overflow-hidden flex flex-col"
        >
          <SheetHeader>
            <SheetTitle>{tab.name}</SheetTitle>
            <SheetDescription>Thread workspace info</SheetDescription>
          </SheetHeader>
          <Tabs
            defaultValue={defaultTab}
            className="flex-1 min-h-0 flex flex-col"
          >
            <TabsList variant="line">
              <TabsTrigger value="diff" className="gap-1.5">
                <RiGitCommitLine className="size-3.5" />
                Diff
              </TabsTrigger>
              <TabsTrigger value="files" className="gap-1.5">
                <RiFolderLine className="size-3.5" />
                Files
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="diff"
              className="flex-1 min-h-0 overflow-auto p-1"
            >
              <div className="mb-2 flex items-center justify-end">
                <button
                  onClick={() => refetchDiff()}
                  className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RiRefreshLine
                    className={cn("size-3", diffLoading && "animate-spin")}
                  />
                  Refresh
                </button>
              </div>
              {diffLoading ? (
                <div className="flex items-center justify-center p-8">
                  <RiLoader4Line className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <DiffView
                  diff={diffData?.diff ?? ""}
                  status={diffData?.status ?? ""}
                />
              )}
            </TabsContent>
            <TabsContent
              value="files"
              className="flex-1 min-h-0 overflow-auto p-1"
            >
              <div className="mb-2 flex items-center justify-end">
                <button
                  onClick={() => refetchFiles()}
                  className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RiRefreshLine
                    className={cn("size-3", filesLoading && "animate-spin")}
                  />
                  Refresh
                </button>
              </div>
              {filesLoading ? (
                <div className="flex items-center justify-center p-8">
                  <RiLoader4Line className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <FileTreeView
                  files={filesData?.files ?? []}
                  onFileSelect={setPreviewFile}
                />
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <FilePreviewSheet
        tab={tab}
        filePath={previewFile}
        open={previewFile !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setPreviewFile(null)
        }}
      />
    </>
  )
}

// --- Terminal group with bottom toolbar ---

function TerminalGroup({
  tab,
  isTabVisible,
}: {
  tab: TabThread
  isTabVisible: boolean
}) {
  const { addTerminal, removeTerminal, setActiveTerminal } = useThreadTabs()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetTab, setSheetTab] = useState("diff")

  const openSheet = (tabName: string) => {
    setSheetTab(tabName)
    setSheetOpen(true)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
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

        <div className="ml-auto flex items-center gap-0.5 pr-1">
          <button
            onClick={() => openSheet("diff")}
            className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            title="View diff"
          >
            <RiGitCommitLine className="size-3" />
            <span>Diff</span>
          </button>
          <button
            onClick={() => openSheet("files")}
            className="flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
            title="File explorer"
          >
            <RiFolderLine className="size-3" />
            <span>Files</span>
          </button>
        </div>
      </div>

      <ThreadInfoSheet
        tab={tab}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        defaultTab={sheetTab}
      />
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
