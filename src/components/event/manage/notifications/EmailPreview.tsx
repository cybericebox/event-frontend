"use client";

import {useQuery} from "@tanstack/react-query";
import {previewManageEmailTemplate, type ManageEmailTemplateInput} from "@/api/manageEmailTemplates";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {EmptyState} from "@/components/ui/EmptyState";
import {t} from "@/i18n/t";
import {EmailPreviewViewport, type EmailViewportControl} from "./EmailPreviewViewport";
import {emailPreviewDocument} from "./emailPreviewDocument";

// The email as it is sent: subject and preheader, then the rendered message on
// the mail canvas with the event's logo and colours and sample values. It
// keeps one size while it loads, fails or shows the message.
export function EmailPreview({event, input, valid = true, viewport}: {event: PublicEventInfo; input: ManageEmailTemplateInput | null; valid?: boolean; viewport?: EmailViewportControl}) {
    const preview = useQuery({
        queryKey: ["event-manage-email-preview", event.EventID, input && JSON.stringify(input)],
        queryFn: () => previewManageEmailTemplate(event.EventID, input!),
        enabled: !!input && valid, retry: false, refetchOnWindowFocus: false, placeholderData: previous => previous,
    });
    return <div className="event-email-preview__frame">
        <dl className="event-email-preview__meta">
            <div><dt>{t("manage.email.subject")}</dt><dd>{preview.data?.Subject || "—"}</dd></div>
            <div><dt>{t("manage.email.preheader")}</dt><dd>{preview.data?.Preheader || "—"}</dd></div>
        </dl>
        <EmailPreviewViewport viewport={viewport} html={input && valid && preview.data && !preview.isError ? emailPreviewDocument(preview.data.HTML) : undefined}>
            {!input || !valid ? <EmptyState message={t("manage.email.previewInvalid")} />
                : preview.isPending ? <EventLoading event={event} label={t("manage.email.previewLoading")} />
                    : preview.isError ? <EventLoadError message={t("manage.email.previewError")} error={preview.error} onRetry={() => void preview.refetch()} />
                        : null}
        </EmailPreviewViewport>
    </div>;
}
