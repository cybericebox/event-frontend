"use client";

import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {ClipboardList} from "lucide-react";
import {getPendingEventForms} from "@/api/participantEventForms";
import {EventLoadError} from "./EventLoadError";
import {t, tPlural} from "@/i18n/t";

export function PendingEventFormsNotice({eventID}: {eventID: string}) {
    const query = useQuery({
        queryKey: ["event-pending-forms", eventID], queryFn: () => getPendingEventForms(eventID),
        retry: false, refetchInterval: 60_000, refetchOnWindowFocus: true,
    });
    if (query.isPending || (query.isSuccess && query.data.length === 0)) return null;
    if (query.isError) return <EventLoadError compact message={t("forms.notice.failed")} error={query.error} onRetry={() => void query.refetch()} />;
    return <div className="event-forms-notice"><ClipboardList size={18} /><div><strong>{t("forms.notice.title")}</strong><p>{query.data.length === 1 ? query.data[0].Form.Title : tPlural("forms.notice.pending", query.data.length)}</p></div><Link className="ib-btn ib-btn--sm" href="/forms">{t("common.view")}</Link></div>;
}
