"use client";

import type {ReactElement} from "react";
import {EventTooltip} from "@/components/ui/EventTooltip";

// Keep shared copy behavior independent of each app's tooltip implementation.
export function CopyActionTooltip({text, children}: {text: string; children: ReactElement}) {
    return <EventTooltip content={text} className="shrink-0" floating silent>{() => children}</EventTooltip>;
}
