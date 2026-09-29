"use client"

import type { ReactElement } from "react"
import { EventTooltip } from "@/components/ui/EventTooltip"

/** The admin editor's tooltip wrapper, on the event tooltip. */
export function HoverTooltip({ text, children, className }: { text: string; children: ReactElement; className?: string; describe?: boolean; truncated?: boolean }) {
  return <EventTooltip content={text} className={className} silent>{() => children}</EventTooltip>
}
