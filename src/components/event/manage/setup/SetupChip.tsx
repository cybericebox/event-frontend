"use client";

import Link from "next/link";
import {t} from "@/i18n/t";
import {useSetup} from "./useSetup";
import "./setup.css";

// The setup progress in the top bar of every /manage page. It turns to a warning
// on a blocker, links to the wizard, and goes quiet once all is done and published.
export function SetupChip({eventID}: {eventID: string}) {
    const setup = useSetup(eventID);
    if (!setup) return null;
    const {done, total, blocked, complete} = setup.summary;
    const state = blocked ? "blocked" : complete ? "done" : "todo";
    const label = complete ? t("manage.setup.chip.done") : t(blocked ? "manage.setup.chip.blocked" : "manage.setup.chip.progress", {done, total});
    return <Link className={`event-setup-chip is-${state}`} href="/manage" aria-label={`${label}. ${t("manage.setup.chip.open")}`}>
        <span>{label}</span>
        {!complete && <span className="event-setup-chip__track" aria-hidden="true"><span style={{width: `${total === 0 ? 0 : Math.round(done / total * 100)}%`}} /></span>}
    </Link>;
}
