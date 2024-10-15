import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type React from "react";
import {ReactQueryDevtools} from "@tanstack/react-query-devtools";

export default function QueryProvider({children}: {
    children: React.ReactNode;
}) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnMount: true,
                refetchOnReconnect: true,
                refetchOnWindowFocus: true,
                staleTime: 5 * 60 * 1000,
                refetchInterval: 5 * 60 * 1000
            },
        }
    })
    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false}/>
        </QueryClientProvider>
    )
}