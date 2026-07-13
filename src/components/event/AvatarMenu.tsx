"use client"

import { useRouter } from "next/navigation"
import { User, MessageSquare, LogOut, ChevronDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/utils/cn"
import { signOut } from "@/api/authAPI"

// Neutralized placeholder until the profile link is wired to the external id-domain page.
const PROFILE_HREF = "#"

function MenuRow({
    icon,
    label,
    onClick,
    href,
    danger,
}: {
    icon: React.ReactNode
    label: string
    onClick?: () => void
    href?: string
    danger?: boolean
}) {
    const className = cn(
        "flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[13.5px] font-medium transition-colors hover:bg-primary/5",
        danger ? "text-destructive" : "text-foreground"
    )
    if (href) {
        return (
            <a href={href} className={className}>
                {icon}
                {label}
            </a>
        )
    }
    return (
        <button type="button" onClick={onClick} className={className}>
            {icon}
            {label}
        </button>
    )
}

// Account menu popover in the top-band (not a route): profile / feedback / sign-out.
// Sign-out reuses the exact pattern from the legacy navbar: call the signOut *Fn, then
// refresh the router so the auth-gated shell re-evaluates and drops to the public landing.
export function AvatarMenu() {
    const router = useRouter()

    const handleSignOut = () => {
        signOut().then(() => {
            router.refresh()
        })
    }

    const iconClass = "size-4 shrink-0 text-muted-foreground"

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="Меню акаунта"
                    className="flex items-center gap-2 rounded-[11px] border border-white/[0.22] bg-white/10 py-1 pl-1 pr-2.5 transition-colors hover:bg-white/20"
                >
                    <Avatar className="size-[30px]">
                        <AvatarFallback className="bg-gradient-to-br from-white to-accent text-xs font-bold text-primary">
                            ІМ
                        </AvatarFallback>
                    </Avatar>
                    <span className="text-[13px] font-semibold text-white">Учасник</span>
                    <ChevronDown className="size-[15px] text-white/85" />
                </button>
            </PopoverTrigger>
            <PopoverContent align="end" sideOffset={10} className="w-[236px] overflow-hidden p-0">
                <div className="flex items-center gap-3 border-b border-border px-3.5 py-3">
                    <Avatar className="size-9">
                        <AvatarFallback className="bg-gradient-to-br from-primary to-cyan text-[13px] font-bold text-primary-foreground">
                            ІМ
                        </AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-col leading-tight">
                        <span className="text-[13.5px] font-bold text-foreground">
                            Учасник
                        </span>
                        <span className="truncate text-[11.5px] text-muted-foreground">
                            Мій акаунт
                        </span>
                    </span>
                </div>

                <div className="py-1">
                    <MenuRow
                        icon={<User className={iconClass} />}
                        label="Профіль"
                        href={PROFILE_HREF}
                    />
                    <MenuRow
                        icon={<MessageSquare className={iconClass} />}
                        label="Форма фідбеку"
                    />
                </div>

                <div className="border-t border-border py-1">
                    <MenuRow
                        icon={<LogOut className="size-4 shrink-0 text-destructive" />}
                        label="Вийти"
                        onClick={handleSignOut}
                        danger
                    />
                </div>
            </PopoverContent>
        </Popover>
    )
}
