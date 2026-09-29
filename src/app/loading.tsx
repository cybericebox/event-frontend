import {EventLoading} from "@/components/event/EventLoading";
import {t} from "@/i18n/t";

export default function Loading() {
    return <EventLoading full label={t("shell.loadingEvent")} />;
}
