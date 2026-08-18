import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/sidebar'
import Header from '@/components/layout/header'
import { getOrCreateWorkspaceAction, getCurrentUser, listUserWorkspacesAction } from '@/actions/workspaces'
import { WorkspaceSwitcher } from '@/components/layout/workspace-switcher'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/sign-in')
  }

  // Deletion pending: the only page this account may reach is the one that
  // offers to restore it.
  if (user.deletionRequestedAt) {
    redirect('/account/recover')
  }

  // Ensure workspace exists
  let workspace = null
  try {
    workspace = await getOrCreateWorkspaceAction()
  } catch (err) {
    console.error("Workspace initialization error:", err)
  }

  return (
    <div className="flex h-dvh min-h-dvh w-full overflow-hidden bg-canvas font-sans text-content">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Header user={user} workspaceSwitcher={<WorkspaceSwitcher workspaces={await listUserWorkspacesAction()} selectedId={workspace?.id ?? ""} />} />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6 relative animate-page-entrance">
          {children}
        </main>
      </div>
    </div>
  )
}
