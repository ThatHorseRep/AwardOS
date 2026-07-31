import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/sidebar'
import Header from '@/components/layout/header'
import { getOrCreateWorkspaceAction, getCurrentUser } from '@/actions/workspaces'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/sign-in')
  }

  // Ensure workspace exists
  try {
    await getOrCreateWorkspaceAction()
  } catch (err) {
    console.error("Workspace initialization error:", err)
  }

  return (
    <div className="flex h-screen w-full bg-[#0a0a0f] text-zinc-100 overflow-hidden font-sans">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-4 md:p-5 lg:p-6 relative">
          {children}
        </main>
      </div>
    </div>
  )
}
