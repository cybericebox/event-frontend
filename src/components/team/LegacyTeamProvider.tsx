"use client";

import {ChakraProvider} from "@chakra-ui/react";
import type {ReactNode} from "react";

export function LegacyTeamProvider({children}: {children: ReactNode}) {
    return <ChakraProvider>{children}</ChakraProvider>;
}
