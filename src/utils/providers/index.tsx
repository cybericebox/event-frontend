'use client'

import type React from "react";
import QueryProvider from "@/utils/providers/queryProvider";
import {Tooltip} from "react-tooltip";

export function Providers({children}: { children: React.ReactNode }) {
    return (
        <QueryProvider>
            {children}
            <Tooltip
                id={"tooltip"}
                className={"!bg-primary"}
            />
        </QueryProvider>
    );
}
