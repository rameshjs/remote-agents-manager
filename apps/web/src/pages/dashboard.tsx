import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"

export default function DashboardPage() {
  const { logout } = useAuth()

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Dashboard</h1>
          <p>You are logged in.</p>
          <Button className="mt-2" variant="outline" onClick={logout}>
            Sign out
          </Button>
        </div>
      </div>
    </div>
  )
}
