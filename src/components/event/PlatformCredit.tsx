import {t, tRich} from "@/i18n/t";

// «Cyber ICE Box · ХНУРЕ» at the end of the event footer's organizer line; ХНУРЕ links to the university.
export function PlatformCredit() {
    return <span className="ib-footer__credit">{tRich("shell.credit", {
        nure: <a href="https://nure.ua" target="_blank" rel="noopener noreferrer" title={t("shell.nureFull")}>{t("shell.nure")}</a>,
    })}</span>;
}
