"use client";

import Link from "next/link";
import type {ReactNode} from "react";
import {useDraftRouter as useRouter} from "@/components/event/manage/manualDraft";
import {joinIntentHref} from "@/utils/joinIntent";

// «Приєднатися» on the site's own pages. The click is the visitor's intent, so /join gets a one-time nonce:
// with no registration fields the application is sent at once and the dialog shows only the result; with
// fields the visitor fills them in. Without script the plain link still opens /join.
export function JoinLink({eventID, className = "ib-btn ib-btn--primary", children}: {eventID: string; className?: string; children: ReactNode}) {
    const router = useRouter();
    return <Link className={className} href="/join" onClick={click => {
        if (click.defaultPrevented || click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return;
        click.preventDefault();
        router.push(joinIntentHref(eventID));
    }}>{children}</Link>;
}
