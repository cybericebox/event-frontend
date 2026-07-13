"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Download, Plus, Shield, ChevronRight } from "lucide-react"
import { cn } from "@/utils/cn"
import { NAV_ITEMS } from "./nav"

// Left navigation column of the app shell. Flat participant nav (no section headers),
// active state derived from the current pathname, plus the bottom block: a lab-config /
// VPN-status card and the team-cabinet link. Matches the sidebar in `.event-app.html`.
export function Sidebar() {
    const pathname = usePathname()

    const isActive = (href: string) =>
        pathname === href || pathname.startsWith(href + "/")

    const cabinetActive = isActive("/cabinet")

    return (
        <aside className="flex w-[248px] shrink-0 flex-col border-r border-border bg-card px-3 pb-3.5 pt-4">
            <nav className="flex flex-col gap-0.5 overflow-y-auto">
                {NAV_ITEMS.map(({ label, href, Icon }) => {
                    const active = isActive(href)
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                "relative flex items-center gap-3 rounded-[9px] px-3 py-2 text-[13.5px] font-medium transition-colors",
                                active
                                    ? "bg-primary/10 text-foreground"
                                    : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
                            )}
                        >
                            {active && (
                                <span className="absolute inset-y-2 left-0 w-[3px] rounded-r bg-primary" />
                            )}
                            <Icon
                                className={cn(
                                    "size-4 shrink-0",
                                    active ? "text-primary" : "text-current"
                                )}
                            />
                            <span className="flex-1">{label}</span>
                        </Link>
                    )
                })}

                <button
                    type="button"
                    className="mt-0.5 flex items-center gap-3 rounded-[9px] px-3 py-2 text-[13px] font-medium text-primary transition-colors hover:bg-primary/5"
                >
                    <Plus className="size-4 shrink-0 text-primary" />
                    <span>Сторінка</span>
                </button>
            </nav>

            <div className="mt-auto flex flex-col gap-2 pt-3">
                <button
                    type="button"
                    className="flex items-center gap-3 rounded-[10px] border border-border bg-card px-3 py-2 text-left transition-colors hover:bg-primary/5"
                >
                    <Download className="size-4 shrink-0 text-primary" />
                    <span className="flex flex-1 flex-col leading-tight">
                        <span className="text-[13px] font-semibold text-foreground">
                            Конфіг лабораторії
                        </span>
                        <span className="flex items-center gap-1.5 text-[11px] text-success">
                            <span className="size-1.5 rounded-full bg-success" />
                            VPN активний
                        </span>
                    </span>
                </button>

                <Link
                    href="/cabinet"
                    className={cn(
                        "flex items-center gap-2.5 rounded-[10px] border px-2.5 py-2 transition-colors",
                        cabinetActive
                            ? "border-primary bg-primary/10"
                            : "border-border bg-card hover:bg-primary/5"
                    )}
                >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] bg-primary/10 text-primary">
                        <Shield className="size-[17px]" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                        <span className="text-[13px] font-semibold text-foreground">
                            Кабінет команди
                        </span>
                        <span className="truncate text-[11.5px] text-muted-foreground">
                            Моя команда
                        </span>
                    </span>
                    <ChevronRight className="size-[15px] shrink-0 text-muted-foreground" />
                </Link>
            </div>
        </aside>
    )
}
