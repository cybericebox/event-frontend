import {t, tRich} from "@/i18n/t";
import {EventTooltip} from "@/components/ui/EventTooltip";

// «Cyber ICE Box · ХНУРЕ» at the end of the event footer's organizer line; ХНУРЕ links to the university,
// its full name in our tooltip (hover / focus).
export function PlatformCredit() {
    return <span className="ib-footer__credit">{tRich("shell.credit", {
        nure: <EventTooltip content={t("shell.nureFull")}>{tipId => <a href="https://nure.ua" target="_blank" rel="noopener noreferrer" aria-describedby={tipId}>{t("shell.nure")}</a>}</EventTooltip>,
    })}</span>;
}
