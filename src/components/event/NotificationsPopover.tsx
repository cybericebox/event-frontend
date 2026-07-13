"use client"

import { Bell, BellOff } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/utils/cn"
import { useGetNotifications } from "@/hooks/useNotifications"
import type { INotification } from "@/types/notification"

// Relative "X ago" label in uk. Kept intentionally small — no date library.
function timeAgo(date: Date): string {
    const diff = Math.max(0, Date.now() - date.getTime())
    const min = Math.floor(diff / 60000)
    if (min < 1) return "щойно"
    if (min < 60) return `${min} хв тому`
    const hours = Math.floor(min / 60)
    if (hours < 24) return `${hours} год тому`
    const days = Math.floor(hours / 24)
    return `${days} дн тому`
}

function NotificationRow({ n, last }: { n: INotification; last: boolean }) {
    return (
        <div
            className={cn(
                "flex gap-3 px-4 py-3",
                !last && "border-b border-border",
                !n.Read && "bg-primary/[0.04]"
            )}
        >
            <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-primary/10 text-primary">
                <Bell className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                    <p className="text-[13px] font-semibold text-foreground">{n.Title}</p>
                    {!n.Read && (
                        <span className="size-[7px] shrink-0 rounded-full bg-primary" />
                    )}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {n.Body}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                    {timeAgo(new Date(n.CreatedAt))}
                </p>
            </div>
        </div>
    )
}

// Bell trigger in a Popover; the panel lists notifications from the mock-backed hook,
// with an unread-count Badge on the bell and an empty state. Matches the prototype's
// notifications popover.
export function NotificationsPopover() {
    const { GetNotificationsResponse, GetNotificationsRequest } = useGetNotifications()
    const items = GetNotificationsResponse?.Data ?? []
    const unread = items.filter((n) => !n.Read).length

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    aria-label="Сповіщення"
                    className="relative flex size-[38px] items-center justify-center rounded-[10px] border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20"
                >
                    <Bell className="size-[17px]" />
                    {unread > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -right-1.5 -top-1.5 h-[18px] min-w-[18px] justify-center rounded-full border-0 px-1 text-[10.5px] leading-none"
                        >
                            {unread}
                        </Badge>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="end"
                sideOffset={10}
                className="flex max-h-[70vh] w-[376px] flex-col overflow-hidden p-0"
            >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <p className="text-sm font-bold text-foreground">Сповіщення</p>
                    <button
                        type="button"
                        className="text-xs font-semibold text-primary hover:underline"
                    >
                        Прочитати всі
                    </button>
                </div>

                {GetNotificationsRequest.isLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <Spinner size="sm" className="text-primary" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                        <BellOff className="size-6 text-muted-foreground" />
                        <p className="text-[13px] font-medium text-foreground">
                            Сповіщень поки немає
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Тут з’являтимуться оголошення події.
                        </p>
                    </div>
                ) : (
                    <div className="overflow-y-auto">
                        {items.map((n, i) => (
                            <NotificationRow
                                key={n.ID}
                                n={n}
                                last={i === items.length - 1}
                            />
                        ))}
                    </div>
                )}
            </PopoverContent>
        </Popover>
    )
}
