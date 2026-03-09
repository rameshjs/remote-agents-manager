import { useState, useCallback } from "react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { NewProjectDialog } from "@/components/new-project-dialog"
import {
  useWorkspaces,
  useDeleteWorkspace,
  useUpdateWorkspace,
  useThreads,
  useCreateThread,
  useDeleteThread,
} from "@/hooks/use-workspaces"
import {
  RiAddLine,
  RiFolderLine,
  RiMoreLine,
  RiDeleteBinLine,
  RiEditLine,
  RiGitBranchLine,
  RiAddCircleLine,
  RiArrowRightSLine,
} from "@remixicon/react"
import type { Workspace, Thread } from "@/api/workspaces"

export function NavWorkspaces() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: workspaces } = useWorkspaces()
  const { isMobile } = useSidebar()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Workspaces</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton onClick={() => setDialogOpen(true)}>
            <RiAddLine />
            <span>New Project</span>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {workspaces?.map((ws) => (
          <WorkspaceItem key={ws.id} workspace={ws} isMobile={isMobile} />
        ))}
      </SidebarMenu>

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </SidebarGroup>
  )
}

function WorkspaceItem({
  workspace: ws,
  isMobile,
}: {
  workspace: Workspace
  isMobile: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [newThreadOpen, setNewThreadOpen] = useState(false)
  const [deleteWsOpen, setDeleteWsOpen] = useState(false)
  const [deleteThreadTarget, setDeleteThreadTarget] = useState<Thread | null>(null)

  const deleteWorkspace = useDeleteWorkspace()
  const updateWorkspace = useUpdateWorkspace()
  const { data: threadsList } = useThreads(expanded ? ws.id : null)
  const createThread = useCreateThread()
  const deleteThread = useDeleteThread()

  const [renameName, setRenameName] = useState(ws.name)
  const [threadName, setThreadName] = useState("")

  const handleRename = () => {
    if (!renameName.trim()) return
    updateWorkspace.mutate(
      { id: ws.id, name: renameName.trim() },
      { onSuccess: () => setRenameOpen(false) }
    )
  }

  const handleCreateThread = () => {
    if (!threadName.trim()) return
    createThread.mutate(
      { workspaceId: ws.id, name: threadName.trim() },
      {
        onSuccess: () => {
          setThreadName("")
          setNewThreadOpen(false)
        },
      }
    )
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton onClick={() => setExpanded(!expanded)}>
        <RiArrowRightSLine
          className={`size-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
        />
        <RiFolderLine />
        <span className="truncate">{ws.name}</span>
      </SidebarMenuButton>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            showOnHover
            className="rounded-sm data-[state=open]:bg-accent"
          >
            <RiMoreLine />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-36 rounded-lg"
          side={isMobile ? "bottom" : "right"}
          align={isMobile ? "end" : "start"}
        >
          <DropdownMenuItem
            onClick={() => {
              setExpanded(true)
              setNewThreadOpen(true)
            }}
          >
            <RiAddCircleLine />
            <span>New Thread</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setRenameName(ws.name)
              setRenameOpen(true)
            }}
          >
            <RiEditLine />
            <span>Rename</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setDeleteWsOpen(true)}
          >
            <RiDeleteBinLine />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {expanded && (
        <SidebarMenuSub>
          {threadsList?.map((thread) => (
            <SidebarMenuSubItem key={thread.id} className="group/thread relative">
              <SidebarMenuSubButton asChild>
                <a href={`#thread-${thread.id}`}>
                  <RiGitBranchLine className="size-3.5" />
                  <span className="truncate pr-6">{thread.name}</span>
                </a>
              </SidebarMenuSubButton>
              <button
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-destructive group-hover/thread:opacity-100"
                onClick={() => setDeleteThreadTarget(thread)}
              >
                <RiDeleteBinLine className="size-3.5" />
              </button>
            </SidebarMenuSubItem>
          ))}

          {threadsList?.length === 0 && (
            <SidebarMenuSubItem>
              <span className="px-2 py-1 text-xs text-muted-foreground">
                No threads yet
              </span>
            </SidebarMenuSubItem>
          )}
        </SidebarMenuSub>
      )}

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Workspace</DialogTitle>
            <DialogDescription>Enter a new name for this workspace.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleRename()
            }}
            className="flex flex-col gap-3"
          >
            <Input
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="Workspace name"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setRenameOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateWorkspace.isPending || !renameName.trim()}>
                Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Workspace Confirmation */}
      <Dialog open={deleteWsOpen} onOpenChange={setDeleteWsOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{ws.name}"? This will remove all
              threads and their worktrees. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteWsOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteWorkspace.isPending}
              onClick={() =>
                deleteWorkspace.mutate(ws.id, {
                  onSuccess: () => setDeleteWsOpen(false),
                })
              }
            >
              {deleteWorkspace.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Thread Confirmation */}
      <Dialog
        open={deleteThreadTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteThreadTarget(null) }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Thread</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deleteThreadTarget?.name}"? This
              will remove its git worktree. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteThreadTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteThread.isPending}
              onClick={() => {
                if (!deleteThreadTarget) return
                deleteThread.mutate(
                  { workspaceId: ws.id, threadId: deleteThreadTarget.id },
                  { onSuccess: () => setDeleteThreadTarget(null) }
                )
              }}
            >
              {deleteThread.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Thread Dialog */}
      <Dialog open={newThreadOpen} onOpenChange={setNewThreadOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Thread</DialogTitle>
            <DialogDescription>
              Creates a new git worktree branch for "{ws.name}".
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleCreateThread()
            }}
            className="flex flex-col gap-3"
          >
            <Input
              value={threadName}
              onChange={(e) => setThreadName(e.target.value)}
              placeholder="Thread name"
              autoFocus
            />
            {createThread.isError && (
              <p className="text-sm text-destructive">
                Failed to create thread. Check that the repository exists.
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNewThreadOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createThread.isPending || !threadName.trim()}>
                {createThread.isPending ? "Creating..." : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </SidebarMenuItem>
  )
}
