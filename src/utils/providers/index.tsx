'use client'

import type React from "react";
import QueryProvider from "@/utils/providers/queryProvider";
import {ChakraProvider} from "@chakra-ui/react"

export function Providers({children}: { children: React.ReactNode }) {
    return (
        <QueryProvider>
            <ChakraProvider>
                {children}
            </ChakraProvider>
        </QueryProvider>
    );
}