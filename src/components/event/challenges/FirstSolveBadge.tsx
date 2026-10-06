import {Droplet} from "lucide-react";
import {t} from "@/i18n/t";

// «Криголам»: the mark of the team that solved a task first.
export function FirstSolveBadge() {
    return <span className="ib-tag ib-tag--sm ib-tag--info"><Droplet size={12} aria-hidden="true" />{t("participation.solves.firstBlood")}</span>;
}
