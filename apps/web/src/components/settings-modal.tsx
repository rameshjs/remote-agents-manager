import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useSetting, useUpdateSetting } from "@/hooks/use-settings"
import { authApi } from "@/api/auth"
import {
  RiLockLine,
  RiGithubLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiLoader4Line,
  RiEyeLine,
  RiEyeOffLine,
} from "@remixicon/react"

export function SettingsModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage your account and integrations.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="password" className="mt-2">
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="password" className="gap-1.5 flex-1">
              <RiLockLine className="size-3.5" />
              Password
            </TabsTrigger>
            <TabsTrigger value="github" className="gap-1.5 flex-1">
              <RiGithubLine className="size-3.5" />
              GitHub PAT
            </TabsTrigger>
          </TabsList>
          <TabsContent value="password" className="mt-4">
            <PasswordTab />
          </TabsContent>
          <TabsContent value="github" className="mt-4">
            <GithubPatTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function PasswordTab() {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      setStatus("error")
      setErrorMsg("Passwords do not match")
      return
    }
    if (newPassword.length < 6) {
      setStatus("error")
      setErrorMsg("New password must be at least 6 characters")
      return
    }
    setStatus("loading")
    try {
      await authApi.changePassword({ currentPassword, newPassword })
      setStatus("success")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      setStatus("error")
      setErrorMsg(err.response?.data?.error || "Failed to change password")
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Current Password</label>
        <div className="relative">
          <Input
            type={showCurrent ? "text" : "password"}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter current password"
            required
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showCurrent ? <RiEyeOffLine className="size-4" /> : <RiEyeLine className="size-4" />}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">New Password</label>
        <div className="relative">
          <Input
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Enter new password"
            required
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showNew ? <RiEyeOffLine className="size-4" /> : <RiEyeLine className="size-4" />}
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Confirm New Password</label>
        <Input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          placeholder="Confirm new password"
          required
        />
      </div>

      {status === "success" && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <RiCheckLine className="size-4" />
          Password changed successfully
        </div>
      )}
      {status === "error" && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <RiErrorWarningLine className="size-4" />
          {errorMsg}
        </div>
      )}

      <Button type="submit" disabled={status === "loading"} className="mt-1">
        {status === "loading" && <RiLoader4Line className="size-4 animate-spin" />}
        {status === "loading" ? "Changing..." : "Change Password"}
      </Button>
    </form>
  )
}

function GithubPatTab() {
  const { data: patSetting, isLoading } = useSetting("github_pat", true)
  const updateSetting = useUpdateSetting()
  const [token, setToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [saved, setSaved] = useState(false)

  const hasPat = patSetting ? !!patSetting.value : false

  const handleSave = () => {
    if (!token.trim()) return
    updateSetting.mutate(
      { key: "github_pat", value: token.trim() },
      {
        onSuccess: () => {
          setSaved(true)
          setToken("")
          setTimeout(() => setSaved(false), 3000)
        },
      }
    )
  }

  const handleClear = () => {
    updateSetting.mutate(
      { key: "github_pat", value: "" },
      { onSuccess: () => setSaved(false) }
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Add a GitHub Personal Access Token to clone private repositories.
        {hasPat ? " A token is currently configured." : ""}
      </p>

      {hasPat && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          <RiCheckLine className="size-4 shrink-0" />
          PAT token is configured
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          {hasPat ? "Replace Token" : "Personal Access Token"}
        </label>
        <div className="relative">
          <Input
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            disabled={isLoading}
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showToken ? <RiEyeOffLine className="size-4" /> : <RiEyeLine className="size-4" />}
          </button>
        </div>
      </div>

      {saved && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <RiCheckLine className="size-4" />
          Token saved successfully
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={handleSave}
          disabled={!token.trim() || updateSetting.isPending}
          className="flex-1"
        >
          {updateSetting.isPending && <RiLoader4Line className="size-4 animate-spin" />}
          {updateSetting.isPending ? "Saving..." : "Save Token"}
        </Button>
        {hasPat && (
          <Button variant="outline" onClick={handleClear} disabled={updateSetting.isPending}>
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}

