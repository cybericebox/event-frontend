import type { ReactNode } from "react"
import { TopBand } from "./TopBand"
import { Sidebar } from "./Sidebar"

// App shell wrapper (participant "App" context, REDESIGN §2): the top band spans the full
// width, the sidebar fills the left column, and `children` render in the scrollable main
// area. Wired into layout.tsx by the next (layout-wiring) task.
export function AppShell({ children }: { children: ReactNode }) {
    return (
        <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
            <TopBand />
            <div className="flex min-h-0 flex-1">
                <Sidebar />
                <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
            </div>
        </div>
    )
}
