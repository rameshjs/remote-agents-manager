import { useEffect, useRef } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldError, FieldGroup } from "@/components/ui/field"
import { useCloneRepo } from "@/hooks/use-clone-repo"
import { useSetting } from "@/hooks/use-settings"
import {
  RiAlertLine,
  RiGitRepositoryLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiLoader4Line,
} from "@remixicon/react"

const cloneRepoSchema = z.object({
  repoUrl: z.url("Please enter a valid repository URL."),
})

type CloneRepoValues = z.infer<typeof cloneRepoSchema>

export function AddFromRepoDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { logs, status, clone, reset: resetClone } = useCloneRepo()
  const logsEndRef = useRef<HTMLDivElement>(null)

  const { data: patSetting } = useSetting("github_pat", open)
  const hasPatToken = patSetting ? !!patSetting.value : null

  const form = useForm<CloneRepoValues>({
    resolver: zodResolver(cloneRepoSchema),
    defaultValues: {
      repoUrl: "",
    },
  })

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [logs])

  function onSubmit(values: CloneRepoValues) {
    const patToken = patSetting?.value || undefined
    clone(values.repoUrl.trim(), patToken)
  }

  const handleClose = (value: boolean) => {
    if (!value) {
      resetClone()
      form.reset()
    }
    onOpenChange(value)
  }

  const isCloning = status === "cloning"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RiGitRepositoryLine className="size-5" />
            Add from Repository
          </DialogTitle>
          <DialogDescription>
            Clone a Git repository into your workspace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)}>
          <FieldGroup>
            {hasPatToken === false && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                <RiAlertLine className="mt-0.5 size-4 shrink-0" />
                <div>
                  <p className="font-medium">
                    No GitHub PAT token configured
                  </p>
                  <p className="mt-0.5 text-xs opacity-80">
                    Private repositories will fail to clone. Add a token in
                    Settings to access private repos.
                  </p>
                </div>
              </div>
            )}

            <Controller
              name="repoUrl"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Repository URL</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    placeholder="https://github.com/user/repo.git"
                    disabled={isCloning}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            {logs.length > 0 && (
              <div className="max-h-48 overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className={
                      log.type === "error"
                        ? "text-destructive"
                        : log.type === "complete"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-muted-foreground"
                    }
                  >
                    {log.message}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            )}

            {status === "complete" && (
              <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                <RiCheckLine className="size-4" />
                Repository cloned successfully
              </div>
            )}

            {status === "error" && logs.some((l) => l.type === "error") && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <RiErrorWarningLine className="size-4" />
                Clone failed. Check the logs above.
              </div>
            )}
          </FieldGroup>

          <DialogFooter className="mt-4">
            {status === "complete" ? (
              <Button type="button" onClick={() => handleClose(false)}>
                Done
              </Button>
            ) : (
              <Button type="submit" disabled={isCloning}>
                {isCloning && (
                  <RiLoader4Line className="size-4 animate-spin" />
                )}
                {isCloning ? "Cloning..." : "Clone Repository"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
