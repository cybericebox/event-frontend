import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type React from "react";
import {useState} from "react";
import {ReactQueryDevtools} from "@tanstack/react-query-devtools";

export default function QueryProvider({children}: {
    children: React.ReactNode;
}) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnMount: true,
                refetchOnReconnect: true,
                refetchOnWindowFocus: true,
                staleTime: 60 * 1000,
                refetchInterval: 60 * 1000,
                // The browser fetch wrapper (trackApiFetch) already repeats a read the server shed;
                // a second retry layer here would multiply the requests on a busy server.
                retry: false,
            },
        }
    }))
    return (
        <QueryClientProvider client={queryClient}>
            {children}
            <ReactQueryDevtools initialIsOpen={false}/>
        </QueryClientProvider>
    )
}
