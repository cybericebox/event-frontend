'use client'

import type React from "react";
import QueryProvider from "@/utils/providers/queryProvider";

export function Providers({children}: { children: React.ReactNode }) {
    return (
        <QueryProvider>
            {children}
        </QueryProvider>
    );
}
