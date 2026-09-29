"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {Copy, Link2, Power, RefreshCw} from "lucide-react";
import {getLiveScreenLink, issueLiveScreenLink, liveScreenExpiries, liveScreenURL, regenerateLiveScreenLink, revokeLiveScreenLink, type LiveScreenExpiry, type LiveScreenLink} from "@/api/manageLive";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {DialogModal} from "@/components/event/DialogModal";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {t} from "@/i18n/t";
import {ConfirmDialog} from "@/components/ui/ConfirmDialog";
import {EventButton} from "@/components/ui/EventButton";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";

const dateFormat = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short"});

// «Посилання для перегляду Live»: one link per event for a projector or LED
// PC that is not signed in. The full URL is shown once, right after it is
// created or regenerated (only its hash is stored).
export function LiveScreenLinksDialog({open, event, onClose}: {open: boolean; event: PublicEventInfo; onClose: () => void}) {
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const queryKey = ["event-live-screen-link", eventID];
    const link = useQuery({queryKey, queryFn: () => getLiveScreenLink(eventID), enabled: open, refetchOnWindowFocus: false});
    const [expiry, setExpiry] = useState<LiveScreenExpiry>("none");
    const [fresh, setFresh] = useState<LiveScreenLink | null>(null);
    const [busy, setBusy] = useState<"issue" | "regenerate" | "revoke" | null>(null);
    const [confirm, setConfirm] = useState<"regenerate" | "revoke" | null>(null);
    // The server clock decides; this only explains why the option is off.
    const [openedAt] = useState(() => Date.now());
    const endAvailable = !!event.FinishTime && Date.parse(event.FinishTime) > openedAt;

    async function run(kind: "issue" | "regenerate" | "revoke", action: () => Promise<LiveScreenLink | undefined>, success: string) {
        setBusy(kind);
        try {
            const issued = await action();
            setFresh(issued?.Token ? issued : null);
            queryClient.setQueryData(queryKey, issued ? {...issued, Token: undefined} : null);
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
    const current = link.data;
    const expires = (value: string | null) => value ? dateFormat.format(new Date(value)) : t("manage.live.links.noExpiry");
    return <DialogModal open={open} onClose={close} size="md" title={t("manage.live.links.title")} description={t("manage.live.links.description")}
        footer={<button className="ib-btn" type="button" onClick={close}>{t("common.close")}</button>}>
        <div className="event-live-links">
            {link.isError ? <EventLoadError message={t("manage.live.links.loadError")} onRetry={() => void link.refetch()} />
                : link.isPending ? <EventLoading event={event} compact label={t("manage.live.links.loading")} />
                    : !current ? <div className="event-live-links__create">
                        <div className="event-live-field">
                            <ManageFieldLabel title={t("manage.live.links.expiry")} help={t("manage.live.links.expiryHelp")} required />
                            <EventSelect ariaLabel={t("manage.live.links.expiry")} value={expiry} onValueChange={value => setExpiry(value as LiveScreenExpiry)}
                                options={liveScreenExpiries.map(value => ({value, label: t(`manage.live.links.expiry.${value}`),
                                    disabled: value === "event_end" && !endAvailable, disabledReason: value === "event_end" && !endAvailable ? t("manage.live.links.expiryNoFinish") : undefined}))} />
                        </div>
                        <EventButton className="ib-btn ib-btn--primary" type="button" busy={busy === "issue"} disabled={!!busy || expiry === "event_end" && !endAvailable}
                            onClick={() => void run("issue", () => issueLiveScreenLink(eventID, expiry), t("manage.live.links.created"))}><Link2 size={16} /> {t("manage.live.links.create")}</EventButton>
                    </div>
                        : <section className="event-live-links__state" aria-label={t("manage.live.links.active")}>
                            <p className="event-live-links__status">{t("manage.live.links.row", {created: dateFormat.format(new Date(current.CreatedAt)), expires: expires(current.ExpiresAt)})}</p>
                            {fresh ? <div className="event-live-links__fresh" role="status">
                                <ManageFieldLabel title={t("manage.live.links.fresh")} help={t("manage.live.links.freshHelp")} htmlFor="live-screen-link-url" />
                                <div className="event-live-links__url">
                                    <input id="live-screen-link-url" className="event-manage-input" readOnly value={freshURL} onFocus={focusEvent => focusEvent.currentTarget.select()} />
                                    <button className="ib-btn" type="button" onClick={() => void copy(freshURL)}><Copy size={16} /> {t("manage.live.links.copy")}</button>
                                </div>
                                <small>{t("manage.live.links.freshHint")}</small>
                            </div> : <p className="event-live-links__hidden">{t("manage.live.links.hiddenURL")}</p>}
                            <div className="event-live-links__actions">
                                <EventTooltip content={t("manage.live.links.regenerateHint")}>{id => <EventButton className="ib-btn" type="button" aria-describedby={id} busy={busy === "regenerate"} disabled={!!busy}
                                    onClick={() => setConfirm("regenerate")}><RefreshCw size={16} /> {t("manage.live.links.regenerate")}</EventButton>}</EventTooltip>
                                <EventButton className="ib-btn" type="button" busy={busy === "revoke"} disabled={!!busy} onClick={() => setConfirm("revoke")}><Power size={16} /> {t("manage.live.links.revoke")}</EventButton>
                            </div>
                        </section>}
        </div>
        <ConfirmDialog open={confirm === "revoke"} tone="danger" busy={busy === "revoke"} onCancel={() => setConfirm(null)}
            title={t("manage.live.links.revokeTitle")} description={t("manage.live.links.revokeBody")} confirmLabel={t("manage.live.links.revoke")}
            onConfirm={() => void run("revoke", async () => {await revokeLiveScreenLink(eventID); return undefined;}, t("manage.live.links.revoked"))} />
        <ConfirmDialog open={confirm === "regenerate"} busy={busy === "regenerate"} onCancel={() => setConfirm(null)}
            title={t("manage.live.links.regenerateTitle")} description={t("manage.live.links.regenerateBody")} confirmLabel={t("manage.live.links.regenerate")}
            onConfirm={() => void run("regenerate", () => regenerateLiveScreenLink(eventID), t("manage.live.links.regenerated"))} />
    </DialogModal>;
}
