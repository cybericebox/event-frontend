'use client'

import {useEffect} from "react";
import {EventErrorScreen} from "@/components/event/EventErrorScreen";

// Segment error boundary: replaces Next's built-in «This page couldn't load» fallback.
// It renders inside the root layout, so the event logo and brand colours still apply.
export default function Error({error, retry}: {
    error: Error & {digest?: string}
    retry: () => void
}) {
    useEffect(() => {
        // details stay out of the UI; developers see them in the console
        if (process.env.NODE_ENV !== "production") console.error(error);
    }, [error]);

    return <EventErrorScreen onRetry={retry} />;
}
