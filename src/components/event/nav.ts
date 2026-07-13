import { ListChecks, Trophy, Users, ScrollText, type LucideIcon } from "lucide-react"

// Flat participant nav (REDESIGN §2). Labels are hardcoded uk copy — this repo has
// no i18n/t() lookup; all user-facing strings live inline like the rest of the app.
export interface NavItem {
    label: string
    href: string
    Icon: LucideIcon
}

export const NAV_ITEMS: readonly NavItem[] = [
    { label: "Завдання", href: "/challenges", Icon: ListChecks },
    { label: "Результати", href: "/scoreboard", Icon: Trophy },
    { label: "Команди", href: "/teams", Icon: Users },
    { label: "Правила", href: "/p/rules", Icon: ScrollText },
] as const
