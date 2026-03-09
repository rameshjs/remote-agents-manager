import { useState } from "react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NewProjectDialog } from "@/components/new-project-dialog"
import { useWorkspaces, useDeleteWorkspace } from "@/hooks/use-workspaces"
import {
  RiAddLine,
  RiFolderLine,
  RiMoreLine,
  RiDeleteBinLine,
} from "@remixicon/react"

export function NavWorkspaces() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { data: workspaces } = useWorkspaces()
  const deleteWorkspace = useDeleteWorkspace()
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
          <SidebarMenuItem key={ws.id}>
            <SidebarMenuButton asChild>
              <a href={`#workspace-${ws.id}`}>
                <RiFolderLine />
                <span>{ws.name}</span>
              </a>
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
                className="w-24 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => deleteWorkspace.mutate(ws.id)}
                >
                  <RiDeleteBinLine />
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>

      <NewProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </SidebarGroup>
  )
}
