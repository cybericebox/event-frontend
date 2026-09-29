"use client";

import {useSyncExternalStore} from "react";
import {t, tSegments} from "@/i18n/t";
import {EventTooltip} from "@/components/ui/EventTooltip";

const YEAR = new Date().getFullYear();
// Touch screens and phones get plain links: no hover there, and no hidden bubble to widen the page.
const PLAIN_QUERY = "(pointer: coarse), (max-width: 767px)";

function subscribePlain(onChange: () => void) {
    const query = window.matchMedia?.(PLAIN_QUERY);
    query?.addEventListener("change", onChange);
    return () => query?.removeEventListener("change", onChange);
}

// «© year Cyber ICE Box · За підтримки кафедри … · ХНУРЕ» in the event footer, as on the landing:
// the department and ХНУРЕ link out; on desktop our tooltip shows their full names (hover / focus).
export function PlatformCredit() {
    const plain = useSyncExternalStore(subscribePlain, () => !!window.matchMedia?.(PLAIN_QUERY).matches, () => false);
    const link = (href: string, label: string, full: string) => plain
        ? <a href={href} target="_blank" rel="noopener noreferrer">{label}</a>
        : <EventTooltip content={full}>{tipId => <a href={href} target="_blank" rel="noopener noreferrer" aria-describedby={tipId}>{label}</a>}</EventTooltip>;
    return <span className="ib-footer__credit">{tSegments("shell.credit", {
        year: YEAR,
        department: link("https://ice.nure.ua/ua/", t("shell.department"), t("shell.departmentFull")),
        nure: link("https://nure.ua", t("shell.nure"), t("shell.nureFull")),
    }, {groupFrom: 1})}</span>;
}
