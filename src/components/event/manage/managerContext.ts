"use client";

import {createContext, useContext} from "react";
import type {PublicEventInfo} from "@/api/publicEventInfo";

// The event and the caller's write access inside the /manage panel (ManagerShell provides it).
export const ManagerContext = createContext<{event: PublicEventInfo; canManage: boolean} | null>(null);

// Exports and report downloads take the data out of the system: owners and write moderators only, never a viewer
// (observer), who reads the same data on the screen (owner decision 2026-10-19; the API refuses it too). Outside the
// panel (a component on its own) nothing is hidden.
export function useCanExport(): boolean {
    const context = useContext(ManagerContext);
    return context ? context.canManage : true;
}
