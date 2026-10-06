"use client";

import Link from "next/link";
import {useQuery} from "@tanstack/react-query";
import {Settings2} from "lucide-react";
import {getManageAccess} from "@/api/manage";
import {t} from "@/i18n/t";

export function ManagerEntry({eventID, variant}: {eventID: string; variant: "nav" | "panel" | "tower"}) {
    const access = useQuery({
        queryKey: ["event-management-access", eventID],
        queryFn: () => getManageAccess(eventID),
        retry: false,
        refetchInterval: false,
        refetchOnWindowFocus: false,
    });
    if (!access.data) return null;
    if (variant === "tower") return <Link className="ib-tower__item" href="/manage"><Settings2 className="ib-icon" aria-hidden="true" /><span className="ib-tower__label">{t("manage.shell.entry")}</span></Link>;
    if (variant === "panel") return <Link href="/manage">{t("manage.shell.entry")}</Link>;
    return <Link className="ib-btn ib-btn--sm event-manage-entry" href="/manage"><Settings2 size={16} aria-hidden="true" />{t("manage.shell.entry")}</Link>;
}
