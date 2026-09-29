import {t, tSegments} from "@/i18n/t";
import {EventTooltip} from "@/components/ui/EventTooltip";

const YEAR = new Date().getFullYear();

// «© year Cyber ICE Box · За підтримки кафедри … · ХНУРЕ» at the end of the event footer's organizer line,
// as on the landing: the department and ХНУРЕ link out with their full names in our tooltip (hover / focus).
export function PlatformCredit() {
    return <span className="ib-footer__credit">{tSegments("shell.credit", {
        year: YEAR,
        department: <EventTooltip content={t("shell.departmentFull")}>{tipId => <a href="https://ice.nure.ua/ua/" target="_blank" rel="noopener noreferrer" aria-describedby={tipId}>{t("shell.department")}</a>}</EventTooltip>,
        nure: <EventTooltip content={t("shell.nureFull")}>{tipId => <a href="https://nure.ua" target="_blank" rel="noopener noreferrer" aria-describedby={tipId}>{t("shell.nure")}</a>}</EventTooltip>,
    })}</span>;
}
