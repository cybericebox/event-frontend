"use client";

import {useMemo, useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowUpRight} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import {discardManageLandingDraft, getManageContent, getManageContentVariables, ManageApiError, publishManageLanding, putManageLanding} from "@/api/manage";
import {BlockStackEditor} from "@/components/event/manage/BlockStackEditor";
import {DraftBar} from "@/components/event/manage/DraftBar";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {validateLanding} from "@/components/event/manage/validatePageBlocks";
import type {ContentDocument} from "@/types/eventContent";
import {t} from "@/i18n/t";

export default function ManageLandingPage() {
    const {event, canManage} = useManager();
    const queryClient = useQueryClient();
    const eventID = event.EventID;
    const content = useQuery({
        queryKey: ["event-management-content", eventID],
        queryFn: () => getManageContent(eventID),
        refetchInterval: false, refetchOnWindowFocus: false,
    });
    const variables = useQuery({
        queryKey: ["event-management-content-variables", eventID],
        queryFn: () => getManageContentVariables(eventID),
        refetchInterval: false, refetchOnWindowFocus: false,
    });
    const [edited, setEdited] = useState<{eventID: string; draft: ContentDocument} | null>(null);
    const [busy, setBusy] = useState<"save" | "publish" | "discard" | null>(null);

    // The editor starts from the saved draft; the site keeps the published landing.
    const saved = content.data ? content.data.LandingDraft ?? content.data.Landing : null;
    const draft = edited?.eventID === eventID ? edited.draft : saved;
    const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);
    const catalog = useMemo(() => (variables.data ?? []).filter(variable => variable.audience === 0), [variables.data]);
    const validation = useMemo(() => draft && variables.data ? validateLanding(draft, catalog, event.PreviewPicture ?? "") : null, [draft, variables.data, catalog, event.PreviewPicture]);
    const publicValues = useMemo(() => Object.fromEntries(catalog.map(variable => [variable.name, content.data?.Variables[variable.name] ?? null])), [content.data?.Variables, catalog]);

    function failure(error: unknown, fallbackKey: string) {
        const status = error instanceof ManageApiError ? error.status : 0;
        toast.error(status === 403 ? t("manage.content.landing.forbidden") : status === 400 ? t("manage.content.landing.rejected") : status === 404 ? t("manage.content.page.gone") : t(fallbackKey));
    }

    async function saveDraft(): Promise<boolean> {
        if (!draft || !content.data) return false;
        await putManageLanding(eventID, draft);
        queryClient.setQueryData(["event-management-content", eventID], {...content.data, LandingDraft: draft});
        setEdited(null);
        return true;
    }

    async function save() {
        if (!canManage || !dirty || validation || busy) return;
        setBusy("save");
        try {
            await saveDraft();
            toast.success(t("manage.content.page.draftSaved"));
        } catch (error) { failure(error, "manage.content.page.saveFailed"); } finally { setBusy(null); }
    }

    async function publish() {
        if (!canManage || validation || busy || !draft) return;
        setBusy("publish");
        try {
            if (dirty) await saveDraft();
            await publishManageLanding(eventID);
            queryClient.setQueryData(["event-management-content", eventID], {...content.data!, Landing: draft, LandingDraft: null});
            setEdited(null);
            toast.success(t("manage.content.landing.published"));
        } catch (error) { failure(error, "manage.content.page.publishFailed"); } finally { setBusy(null); }
    }

    async function discardDraft() {
        if (!canManage || busy || !content.data?.LandingDraft) return;
        setBusy("discard");
        try {
            await discardManageLandingDraft(eventID);
            queryClient.setQueryData(["event-management-content", eventID], {...content.data, LandingDraft: null});
            setEdited(null);
            toast.success(t("manage.content.page.discarded"));
        } catch (error) { failure(error, "manage.content.page.discardFailed"); } finally { setBusy(null); }
    }

    if (content.isError || variables.isError) return <EventLoadError message={t("manage.content.landing.loadFailed")} error={content.error ?? variables.error} onRetry={() => void Promise.all([content.refetch(), variables.refetch()])} />;
    if (content.isPending || variables.isPending || !draft) return <EventLoading event={event} label={t("manage.content.landing.loading")} />;

    return <div className="event-manage-content">
        <header className="event-manage-heading"><div><h1>{t("manage.content.landing.title")}</h1><p>{t("manage.content.landing.lead")}</p></div>{event.Status !== 0 && event.Status !== 4 && <Link className="ib-btn" href="/" target="_blank">{t("manage.content.landing.openOnSite")} <ArrowUpRight size={16} /></Link>}</header>
        {!canManage && <div className="event-manage-notice" role="status">{t("manage.content.landing.readOnly")}</div>}
        {event.Status === 0 && <div className="event-manage-notice" role="status">{t("manage.content.landing.siteUnpublished")}</div>}
        <DraftBar state={{dirty, hasDraft: !!content.data.LandingDraft, published: true}} busy={busy} canManage={canManage} invalid={!!validation}
            onSave={() => void save()} onPublish={() => void publish()} onRevertLocal={() => setEdited(null)} onDiscardDraft={() => void discardDraft()} />
        <BlockStackEditor editorKey={`landing:${eventID}`} eventID={eventID} coverImage={event.PreviewPicture ?? ""} document={draft} catalog={catalog} values={publicValues} validation={validation}
            canEdit={canManage && !busy} landing previewTitle={event.Name} previewClassName="event-landing ib-blocks"
            onChange={update => setEdited(previous => {
                const current = previous?.eventID === eventID ? previous.draft : saved;
                return current ? {eventID, draft: update(current)} : previous;
            })} />
    </div>;
}
