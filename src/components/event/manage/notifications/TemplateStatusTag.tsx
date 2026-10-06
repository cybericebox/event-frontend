import type {ListStatus} from "./notificationModel";
import {t} from "@/i18n/t";

const classes: Record<ListStatus, string> = {published: "ib-tag--ok", draft: "ib-tag--warn", unpublished: "", platform: "ib-tag--role"};

// The status of a template as a tag: the event's own versions or the platform template.
export function TemplateStatusTag({status}: {status: ListStatus}) {
    return <span className={`ib-tag ${classes[status]}`.trim()}>{status === "platform" ? t("manage.notifications.platformTemplate") : t(`manage.notifications.status.${status}`)}</span>;
}
