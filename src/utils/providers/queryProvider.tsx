import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type React from "react";
import toast from "react-hot-toast";
import {useRouter} from "next/navigation";

export default function QueryProvider({children}: {
    children: React.ReactNode;
}) {
    const router = useRouter()
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                refetchOnWindowFocus: false,
                refetchOnMount: false,
                refetchOnReconnect: false,
                staleTime: 5 * 60 * 1000,
                refetchInterval: 5 * 60 * 1000,
            },
            mutations: {
                onError: (error) => {
                    const res = error.cause as Response
                    if (res.status === 401 || res.status === 307) {
                        router.refresh()
                    } else {
                        toast.error(error.message);
                    }
                }
            }
        }
    })
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}