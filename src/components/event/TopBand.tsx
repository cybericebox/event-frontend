"use client"

import Link from "next/link"
import { Trophy } from "lucide-react"
import Logo from "@/components/Logo"
import { CountdownTimer } from "@/components/Countdown"
import { Spinner } from "@/components/ui/spinner"
import { useEvent } from "@/hooks/useEvent"
import { NotificationsPopover } from "./NotificationsPopover"
import { AvatarMenu } from "./AvatarMenu"

// Full-width top band of the app shell. Left: logo (→ home) + event name/subtitle from the
// event-info hook. Right: standing chip, finish countdown, notifications + avatar popovers.
// Indigo gradient matches the prototype header; the band sits above the sidebar/main row.
export function TopBand() {
    const { useGetEventInfo } = useEvent()
    const { GetEventInfoResponse, GetEventInfoRequest } = useGetEventInfo()
    const event = GetEventInfoResponse?.Data
    const loading = GetEventInfoRequest.isLoading

    return (
        <header
            className="relative z-30 flex shrink-0 items-center gap-4 border-b border-white/10 px-5 py-2.5 text-white"
            style={{
                background:
                    "linear-gradient(90deg,#172159,hsl(var(--primary)) 55%,#243488)",
            }}
        >
            <div className="flex items-center gap-3 text-white">
                <Logo width={34} height={34} />
                <Link href="/" className="flex flex-col leading-tight" aria-label="На головну">
                    {loading ? (
                        <Spinner size="sm" className="text-primary-foreground" />
                    ) : (
                        <>
                            <span className="text-[15px] font-bold">
                                {event?.Name ?? "Подія"}
                            </span>
                            <span className="text-[11px] text-white/70">Jeopardy CTF</span>
                        </>
                    )}
                </Link>
            </div>

            <div className="ml-auto flex items-center gap-3">
                {/* Standing chip: static placeholder — no rank/standing data in the current
                    fixtures/schema. A later page project wires the real standing endpoint. */}
                <div className="hidden items-center gap-2 rounded-[11px] border border-white/20 bg-white/10 px-3 py-1.5 sm:flex">
                    <Trophy className="size-4" />
                    <span className="text-sm font-bold tabular-nums">#4 · 1 250 балів</span>
                </div>

                {loading ? (
                    <Spinner size="sm" className="text-primary-foreground" />
                ) : event ? (
                    <div className="hidden items-center rounded-[11px] border border-white/25 bg-white/10 px-3.5 py-1.5 md:flex">
                        <CountdownTimer
                            text="До завершення"
                            until={new Date(event.FinishTime)}
                            className="!min-w-0 space-y-0 text-sm font-semibold text-white md:!min-w-0"
                        />
                    </div>
                ) : null}

                <NotificationsPopover />
                <AvatarMenu />
            </div>
        </header>
    )
}
