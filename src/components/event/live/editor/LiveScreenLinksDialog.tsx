"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {Copy, Link2, RefreshCw, X} from "lucide-react";
import {createLiveScreenLink, listLiveScreenLinks, liveScreenExpiries, liveScreenURL, regenerateLiveScreenLink, revokeLiveScreenLink, type LiveScreenExpiry, type LiveScreenLink} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {DialogModal} from "@/components/event/DialogModal";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {t} from "@/i18n/t";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";

const dateFormat = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short"});

// «Посилання для екрана»: tokenized URLs for projector or LED PCs that are
// not signed in. The full URL is shown once, right after it is issued or
// regenerated; the list keeps only the dates.
export function LiveScreenLinksDialog({open, event, onClose}: {open: boolean; event: PublicEventInfo; onClose: () => void}) {
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const queryKey = ["event-live-screen-links", eventID];
    const links = useQuery({queryKey, queryFn: () => listLiveScreenLinks(eventID), enabled: open, refetchOnWindowFocus: false});
    const [expiry, setExpiry] = useState<LiveScreenExpiry>("day");
    const [fresh, setFresh] = useState<LiveScreenLink | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [confirm, setConfirm] = useState<{kind: "regenerate" | "revoke"; link: LiveScreenLink} | null>(null);
    const finish = event.FinishTime ? Date.parse(event.FinishTime) : null;
    // The server clock decides; this only explains why the option is off.
    const [openedAt] = useState(() => Date.now());
    const endAvailable = finish !== null && finish > openedAt;

    async function run(key: string, action: () => Promise<LiveScreenLink | undefined>, success: string) {
        setBusy(key);
        try {
            const link = await action();
            if (link?.Token) setFresh(link);
            await queryClient.invalidateQueries({queryKey});
            toast.success(success);
        } catch {toast.error(t("manage.live.links.error"));}
        finally {setBusy(null); setConfirm(null);}
    }
    async function copy(url: string) {
        try {
            await navigator.clipboard.writeText(url);
            toast.success(t("manage.live.links.copied"));
        } catch {toast.error(t("manage.live.links.copyError"));}
    }
    const close = () => {setFresh(null); onClose();};
    const freshURL = fresh?.Token ? liveScreenURL(window.location.origin, fresh.Token) : "";
    return <DialogModal open={open} onClose={close} size="md" title={t("manage.live.links.title")} description={t("manage.live.links.description")}
        footer={<button className="ib-btn" type="button" onClick={close}>{t("common.close")}</button>}>
        <div className="event-live-links">
            <div className="event-live-links__create">
                <div className="event-live-field">
                    <span className="event-live-field__label">{t("manage.live.links.expiry")}</span>
                    <EventSelect ariaLabel={t("manage.live.links.expiry")} value={expiry} onValueChange={value => setExpiry(value as LiveScreenExpiry)}
                        options={liveScreenExpiries.map(value => ({value, label: t(`manage.live.links.expiry.${value}`),
                            disabled: value === "event_end" && !endAvailable, disabledReason: value === "event_end" && !endAvailable ? t("manage.live.links.expiryNoFinish") : undefined}))} />
                </div>
                <EventButton className="ib-btn ib-btn--primary" type="button" busy={busy === "create"} disabled={!!busy || expiry === "event_end" && !endAvailable}
                    onClick={() => void run("create", () => createLiveScreenLink(eventID, expiry), t("manage.live.links.created"))}><Link2 size={16} /> {t("manage.live.links.create")}</EventButton>
            </div>
            {fresh && <div className="event-live-links__fresh" role="status">
                <span className="event-live-field__label">{t("manage.live.links.fresh")}</span>
                <div className="event-live-links__url">
                    <input className="event-manage-input" readOnly value={freshURL} aria-label={t("manage.live.links.fresh")} onFocus={focusEvent => focusEvent.currentTarget.select()} />
                    <button className="ib-btn" type="button" onClick={() => void copy(freshURL)}><Copy size={16} /> {t("manage.live.links.copy")}</button>
                </div>
                <small>{t("manage.live.links.freshHint", {date: dateFormat.format(new Date(fresh.ExpiresAt))})}</small>
            </div>}
            <section className="event-live-links__list" aria-label={t("manage.live.links.active")}>
                <h3>{t("manage.live.links.active")}</h3>
                {links.isError ? <EventLoadError message={t("manage.live.links.loadError")} onRetry={() => void links.refetch()} />
                    : links.isPending ? <EventLoading event={event} compact label={t("manage.live.links.loading")} />
                        : links.data.length === 0 ? <EmptyState compact message={t("manage.live.links.empty")} />
                            : <ul>{links.data.map(link => <li key={link.ID}>
                                <span>{t("manage.live.links.row", {created: dateFormat.format(new Date(link.CreatedAt)), expires: dateFormat.format(new Date(link.ExpiresAt))})}</span>
                                <EventTooltip content={t("manage.live.links.regenerateHint")}>{id => <EventButton className="ib-btn ib-btn--sm" type="button" aria-describedby={id} busy={busy === `regenerate-${link.ID}`} disabled={!!busy}
                                    onClick={() => setConfirm({kind: "regenerate", link})}><RefreshCw size={14} /> {t("manage.live.links.regenerate")}</EventButton>}</EventTooltip>
                                <EventButton className="ib-btn ib-btn--sm" type="button" busy={busy === `revoke-${link.ID}`} disabled={!!busy}
                                    onClick={() => setConfirm({kind: "revoke", link})}><X size={14} /> {t("manage.live.links.revoke")}</EventButton>
                            </li>)}</ul>}
            </section>
        </div>
        <ConfirmDialog open={confirm?.kind === "revoke"} tone="danger" busy={!!busy} onCancel={() => setConfirm(null)}
            title={t("manage.live.links.revokeTitle")} description={t("manage.live.links.revokeBody")} confirmLabel={t("manage.live.links.revoke")}
            onConfirm={() => {if (confirm) void run(`revoke-${confirm.link.ID}`, async () => {await revokeLiveScreenLink(eventID, confirm.link.ID); if (fresh?.ID === confirm.link.ID) setFresh(null); return undefined;}, t("manage.live.links.revoked"));}} />
        <ConfirmDialog open={confirm?.kind === "regenerate"} busy={!!busy} onCancel={() => setConfirm(null)}
            title={t("manage.live.links.regenerateTitle")} description={t("manage.live.links.regenerateBody")} confirmLabel={t("manage.live.links.regenerate")}
            onConfirm={() => {if (confirm) void run(`regenerate-${confirm.link.ID}`, () => regenerateLiveScreenLink(eventID, confirm.link.ID), t("manage.live.links.regenerated"));}} />
    </DialogModal>;
}
