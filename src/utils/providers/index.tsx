'use client'

import type React from "react";
import QueryProvider from "@/utils/providers/queryProvider";
import {installClientToken} from "@/utils/clientToken";

// Before the first render, so no child fetch can run ahead of it. Does nothing unless DOS protection is on.
installClientToken();

export function Providers({children}: { children: React.ReactNode }) {
    return (
        <QueryProvider>
            {children}
        </QueryProvider>
    );
}
