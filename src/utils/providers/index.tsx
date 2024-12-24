'use client'

import type React from "react";
import QueryProvider from "@/utils/providers/queryProvider";
import {ChakraProvider} from "@chakra-ui/react"
import {Tooltip} from "react-tooltip";

export function Providers({children}: { children: React.ReactNode }) {
    return (
        <QueryProvider>
            <ChakraProvider>
                {children}
            </ChakraProvider>
            <Tooltip
                id={"tooltip"}
                className={"!bg-primary"}
            />
        </QueryProvider>
    );
}