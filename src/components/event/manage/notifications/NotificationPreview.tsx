"use client";

import {useId, useState, type ComponentProps} from "react";
import {Maximize2} from "lucide-react";
import {DialogModal} from "@/components/event/DialogModal";
import {t} from "@/i18n/t";
import {EmailPreview} from "./EmailPreview";
import {InAppPreview} from "./InAppPreview";
import type {EmailPreviewDevice} from "./EmailPreviewViewport";

type Props = {email?: ComponentProps<typeof EmailPreview>; inApp?: ComponentProps<typeof InAppPreview>};
type Channel = "email" | "inbox" | "toast";

/** The same channel switcher for templates, composition and sent messages. */
export function NotificationPreview({email, inApp}: Props) {
    const [selected, setSelected] = useState<Channel>(email ? "email" : "inbox");
    const [expanded, setExpanded] = useState(false);
    const [emailDevice, setEmailDevice] = useState<EmailPreviewDevice | null>(null);
    const id = useId();
    const channels: Channel[] = [...(email ? ["email" as const] : []), ...(inApp ? ["inbox" as const, "toast" as const] : [])];
    const active = channels.includes(selected) ? selected : channels[0];
    const content = (prefix: string) => <div className="event-notification-preview">
        <div className="event-notification-preview__head">
            <div className="ib-seg ib-seg--sm event-notification-preview__tabs" role="tablist" aria-label={t("manage.notifications.preview.tabs")}>
                {channels.map(channel => <button key={channel} type="button" role="tab" id={`${prefix}-${channel}-tab`} aria-controls={`${prefix}-${channel}-panel`}
                    aria-selected={active === channel} tabIndex={active === channel ? 0 : -1} onClick={() => setSelected(channel)}
                    onKeyDown={event => {
                        const index = channels.indexOf(channel);
                        const next = event.key === "Home" ? 0 : event.key === "End" ? channels.length - 1 : event.key === "ArrowRight" ? (index + 1) % channels.length : event.key === "ArrowLeft" ? (index + channels.length - 1) % channels.length : -1;
                        if (next < 0) return;
                        event.preventDefault(); setSelected(channels[next]);
                        (event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next])?.focus();
                    }}>{t(`manage.notifications.preview.${channel}`)}</button>)}
            </div>
            {!expanded && <button className="ib-btn ib-btn--sm" type="button" onClick={() => setExpanded(true)}><Maximize2 size={15} aria-hidden="true" />{t("manage.notifications.preview.expand")}</button>}
        </div>
        {channels.map(channel => <div key={channel} id={`${prefix}-${channel}-panel`} role="tabpanel" aria-labelledby={`${prefix}-${channel}-tab`} hidden={active !== channel} tabIndex={0} className="event-notification-preview__panel">
            {channel === "email" && email ? <EmailPreview {...email} viewport={{device: emailDevice, onDeviceChange: setEmailDevice}} /> : inApp ? <InAppPreview {...inApp} surface={channel === "inbox" ? "inbox" : "toast"} /> : null}
        </div>)}
    </div>;
    if (channels.length === 0) return null;
    return <>
        {content(id)}
        <DialogModal open={expanded} onClose={() => setExpanded(false)} title={t("manage.notifications.preview")} size="md">{expanded && content(`${id}-expanded`)}</DialogModal>
    </>;
}
