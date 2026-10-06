import {EmptyState} from "@/components/ui/EmptyState";

// An empty list keeps its header: the message fills one body cell, centred.
export function TableEmptyBody({colSpan, message}: {colSpan: number; message: string}) {
    return <tbody><tr><td className="event-manage-table__state" colSpan={colSpan}><div className="event-manage-table__state-view"><EmptyState message={message} /></div></td></tr></tbody>;
}
