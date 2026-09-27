"use client";

import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {ClipboardList} from "lucide-react";
import {getPendingEventForms} from "@/api/participantEventForms";

export function PendingEventFormsNotice({eventID}: {eventID: string}) {
    const query = useQuery({
        queryKey: ["event-pending-forms", eventID], queryFn: () => getPendingEventForms(eventID),
        retry: false, refetchInterval: 60_000, refetchOnWindowFocus: true,
    });
    if (query.isPending || (query.isSuccess && query.data.length === 0)) return null;
    if (query.isError) return <div className="event-forms-notice" role="alert"><span>Не вдалося перевірити форми для заповнення.</span><button className="ib-btn ib-btn--sm" type="button" onClick={() => void query.refetch()}>Повторити</button></div>;
    return <div className="event-forms-notice"><ClipboardList size={18} /><div><strong>Є форми для заповнення</strong><p>{query.data.length === 1 ? query.data[0].Form.Title : `${query.data.length} форми очікують на відповідь`}</p></div><Link className="ib-btn ib-btn--sm" href="/forms">Переглянути</Link></div>;
}
