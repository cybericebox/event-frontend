import {EventTooltip} from "@/components/ui/EventTooltip";
import {agoText} from "@/components/event/labLive";
import {formatDateTime} from "@/utils/dateTime";
import {t} from "@/i18n/t";

// A «last time» cell: how long ago, the exact time in a tooltip, «ніколи» when it never happened.
export function LastActivity({at}: {at: string | null}) {
    if (!at) return <span className="event-manage-table__dim">{t("manage.participants.col.never")}</span>;
    return <EventTooltip content={formatDateTime(at)}>{id => <span aria-describedby={id}>{agoText(at)}</span>}</EventTooltip>;
}
