"use client";

import {createContext, useContext} from "react";
import type {PublicEventInfo} from "@/api/publicEventInfo";

// The event and the caller's access inside the /manage panel (ManagerShell provides it).
export const ManagerContext = createContext<{event: PublicEventInfo; canManage: boolean; canExport: boolean} | null>(null);

// Exports and report downloads take the data out of the system: the owner, write moderators and platform admins
// (CanExport of /manage/access, the same rule as the export routes), never a viewer or an admin viewer, who read the
// same data on the screen (owner rulings 2026-10-19). Outside the panel nothing is exported.
export function useCanExport(): boolean {
    return useContext(ManagerContext)?.canExport ?? false;
}
