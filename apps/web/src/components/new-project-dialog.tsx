import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useProjects } from "@/hooks/use-projects"
import { useCreateWorkspace } from "@/hooks/use-workspaces"
import {
  RiFolderLine,
  RiLoader4Line,
  RiFolderOpenLine,
} from "@remixicon/react"

export function NewProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: projects, isLoading } = useProjects(open)
  const createWorkspace = useCreateWorkspace()

  const handleSelect = (project: { name: string; path: string }) => {
    createWorkspace.mutate(
      { name: project.name, repoPath: project.path },
      {
        onSuccess: () => onOpenChange(false),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiFolderOpenLine className="size-5" />
            New Project
          </DialogTitle>
          <DialogDescription>
            Select a repository from your workdir to create a workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-64 overflow-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <RiLoader4Line className="size-5 animate-spin" />
            </div>
          )}

          {!isLoading && projects?.length === 0 && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No repositories found in .workdir/repos.
              <br />
              Clone a repository first using "Add from Repo".
            </div>
          )}

          {!isLoading && projects && projects.length > 0 && (
            <div className="flex flex-col gap-1">
              {projects.map((project) => (
                <Button
                  key={project.name}
                  variant="ghost"
                  className="h-auto justify-start gap-3 px-3 py-2.5"
                  disabled={createWorkspace.isPending}
                  onClick={() => handleSelect(project)}
                >
                  <RiFolderLine className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate font-medium">{project.name}</span>
                </Button>
              ))}
            </div>
          )}

          {createWorkspace.isError && (
            <p className="mt-2 text-sm text-destructive">
              Failed to create workspace.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
