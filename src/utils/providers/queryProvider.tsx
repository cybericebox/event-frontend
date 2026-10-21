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
                // No query polls or refetches on focus by default: /auth/me, navigation and access queries do not change
                // during a session. A query whose data changes sets its own refetchInterval / refetchOnWindowFocus.
                // The banner bar and the inbox follow the shared pulse (utils/pulse.ts).
                refetchOnWindowFocus: false,
                staleTime: 60 * 1000,
                refetchInterval: false,
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
