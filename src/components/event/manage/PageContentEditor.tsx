"use client";

import {useId, useMemo, useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowUpRight, ChevronDown, Trash2} from "lucide-react";
import toast from "react-hot-toast";
import {createManagePage, deleteManagePage, discardManagePageDraft, editablePage, getManageConfig, getManageContent, getManageContentVariables, getManagePage, getManagePages, ManageApiError, type ManagePage, type ManagePageInput, publishManagePage, saveManagePageDraft} from "@/api/manage";
import type {ContentDocument} from "@/types/eventContent";
import {FieldLabel} from "./PageBlockEditor";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle} from "@/components/ui/dialog";
import {useManager} from "./ManagerShell";
import {EventLoading} from "../EventLoading";
import {validateLanding} from "./validatePageBlocks";
import {reservedPageSlugs} from "../content/pageSlugs";
import {beforeChallenges, comparePageOrder} from "../content/pageNavigationOrder";
import {BlockStackEditor} from "./BlockStackEditor";
import {DraftBar} from "./DraftBar";
import {t} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";

const emptyPage: ManagePageInput = {
    Slug: "", Title: "", Document: {blocks: []}, Visibility: 0, Navigation: 1, NavigationAfter: "",
};

// The page's current navbar place as a placement choice ("after …").
function currentPlacement(page: ManagePage | undefined, pages: ManagePage[], scoreboardShown: boolean): string {
    const ordered = pages.filter(item => item.PublishedAt && item.Navigation !== 0).sort(comparePageOrder);
    const others = ordered.filter(item => item.ID !== page?.ID);
    const index = ordered.findIndex(item => item.ID === page?.ID);
    const current = index < 0 ? null : ordered[index];
    const previous = index <= 0 ? null : ordered[index - 1];
    if (!current) return scoreboardShown ? others.filter(item => item.NavigationOrder >= 0).at(-1)?.ID ?? "results" : others.filter(item => item.NavigationOrder < 0 && !beforeChallenges(item.NavigationOrder)).at(-1)?.ID ?? "challenges";
    if (beforeChallenges(current.NavigationOrder)) return previous && beforeChallenges(previous.NavigationOrder) ? previous.ID : "first";
    if (current.NavigationOrder < 0) return previous && previous.NavigationOrder < 0 && !beforeChallenges(previous.NavigationOrder) ? previous.ID : "challenges";
    return previous && previous.NavigationOrder >= 0 ? previous.ID : "results";
}

export function CustomPageEditor({slug}: {slug?: string}) {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const router = useRouter();
    const queryClient = useQueryClient();
    const key = slug ?? "new";
    const isNew = !slug;
    const page = useQuery({queryKey: ["event-management-page", eventID, slug], queryFn: () => getManagePage(eventID, slug!), enabled: !isNew, retry: false, refetchOnWindowFocus: false});
    const pages = useQuery({queryKey: ["event-management-pages", eventID], queryFn: () => getManagePages(eventID), retry: false, refetchOnWindowFocus: false});
    const config = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), retry: false, refetchOnWindowFocus: false});
    const content = useQuery({queryKey: ["event-management-content", eventID], queryFn: () => getManageContent(eventID), retry: false, refetchOnWindowFocus: false});
    const definitions = useQuery({queryKey: ["event-management-content-variables", eventID], queryFn: () => getManageContentVariables(eventID), retry: false, refetchOnWindowFocus: false});
    const [edited, setEdited] = useState<{key: string; value: ManagePageInput} | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(true);
    const detailsID = useId();
    const [busy, setBusy] = useState<"save" | "publish" | "discard" | null>(null);
    const [deleteOpen, setDeleteOpen] = useState(false);

    const existingPages = pages.data ?? [];
    const scoreboardShown = config.data?.ScoreboardVisibility !== 0;
    const placement = currentPlacement(page.data, existingPages, scoreboardShown);
    const saved: ManagePageInput = page.data ? editablePage(page.data) : {...emptyPage, NavigationAfter: placement};
    const draft = edited?.key === key ? edited.value : saved;
    const shownPlacement = draft.NavigationAfter || placement;
    const catalog = useMemo(() => (definitions.data ?? []).filter(item => item.audience <= draft.Visibility), [definitions.data, draft.Visibility]);
    const values = useMemo(() => Object.fromEntries(catalog.map(item => [item.name, content.data?.Variables[item.name] ?? null])), [catalog, content.data?.Variables]);
    const documentError = definitions.data ? validateLanding(draft.Document, catalog, event.PreviewPicture ?? "") : null;
    const slugTaken = existingPages.some(item => item.ID !== page.data?.ID && (item.Slug === draft.Slug || item.Draft?.Slug === draft.Slug));
    const slugError = reservedPageSlugs.has(draft.Slug) ? t("manage.content.page.slugReserved", {slug: draft.Slug}) :
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.Slug) || draft.Slug.length > 128 ? t("manage.content.page.slugInvalid") :
        slugTaken ? t("manage.content.page.slugTaken") :
        null;
    const titleError = !draft.Title.trim() || draft.Title.length > 255 ? t("manage.content.page.titleInvalid") : null;
    const validation = slugError ?? titleError ?? documentError;
    const dirty = isNew || JSON.stringify(saved) !== JSON.stringify(draft);
    const published = !!page.data?.PublishedAt;

    function change(next: ManagePageInput) {
        setEdited({key, value: next});
    }
    function changeDocument(update: (document: ContentDocument) => ContentDocument) {
        setEdited(previous => {
            const current = previous?.key === key ? previous.value : saved;
            return {key, value: {...current, Document: update(current.Document)}};
        });
        setDetailsOpen(false);
    }

    function payload(): ManagePageInput {
        return {...draft, Navigation: draft.Visibility === 2 ? 0 : draft.Navigation};
    }

    async function refresh() {
        await Promise.all([
            queryClient.invalidateQueries({queryKey: ["event-management-pages", eventID]}),
            queryClient.invalidateQueries({queryKey: ["event-navigation-pages", eventID]}),
            queryClient.invalidateQueries({queryKey: ["event-management-page", eventID]}),
        ]);
    }

    function failure(error: unknown, fallbackKey: string) {
        const status = error instanceof ManageApiError ? error.status : 0;
        toast.error(status === 400 ? t("manage.content.page.rejected") : status === 409 ? t("manage.content.page.conflict") : status === 404 ? t("manage.content.page.gone") : t(fallbackKey));
    }

    // Stores the draft; returns the stored page.
    async function storeDraft(): Promise<ManagePage> {
        const result = isNew ? await createManagePage(eventID, payload()) : dirty ? await saveManagePageDraft(eventID, page.data!.ID, payload()) : page.data!;
        queryClient.setQueryData(["event-management-page", eventID, result.Draft?.Slug ?? result.Slug], result);
        return result;
    }

    async function save() {
        if (!canManage || validation || !dirty || busy) return;
        setBusy("save");
        try {
            const result = await storeDraft();
            await refresh();
            setEdited(null);
            toast.success(isNew ? t("manage.content.page.created") : t("manage.content.page.draftSaved"));
            const editorSlug = result.Draft?.Slug ?? result.Slug;
            if (editorSlug !== slug) router.replace(`/manage/content/pages/${editorSlug}`);
        } catch (error) { failure(error, "manage.content.page.saveFailed"); } finally { setBusy(null); }
    }

    async function publish() {
        if (!canManage || validation || busy) return;
        setBusy("publish");
        try {
            const stored = await storeDraft();
            const result = await publishManagePage(eventID, stored.ID);
            queryClient.setQueryData(["event-management-page", eventID, result.Slug], result);
            await refresh();
            setEdited(null);
            toast.success(t("manage.content.page.published"));
            if (result.Slug !== slug) router.replace(`/manage/content/pages/${result.Slug}`);
        } catch (error) { failure(error, "manage.content.page.publishFailed"); } finally { setBusy(null); }
    }

    async function discardDraft() {
        if (!canManage || busy || !page.data) return;
        setBusy("discard");
        try {
            await discardManagePageDraft(eventID, page.data.ID);
            await refresh();
            setEdited(null);
            toast.success(t("manage.content.page.discarded"));
            if (page.data.Slug !== slug) router.replace(`/manage/content/pages/${page.data.Slug}`);
        } catch (error) { failure(error, "manage.content.page.discardFailed"); } finally { setBusy(null); }
    }

    async function remove() {
        if (!page.data || !canManage) return;
        setBusy("discard");
        try {
            await deleteManagePage(eventID, page.data.ID);
            await Promise.all([
                queryClient.invalidateQueries({queryKey: ["event-management-pages", eventID]}),
                queryClient.invalidateQueries({queryKey: ["event-navigation-pages", eventID]}),
            ]);
            toast.success(t("manage.content.page.deleted"));
            router.replace("/manage/content/landing");
        } catch {
            toast.error(t("manage.content.page.deleteFailed"));
            setBusy(null);
        }
    }

    if (page.isError || pages.isError || config.isError || content.isError || definitions.isError) return <div className="event-manage-error" role="alert"><h1>{t("manage.content.page.loadFailed")}</h1><button className="ib-btn" onClick={() => void Promise.all([page.refetch(), pages.refetch(), config.refetch(), content.refetch(), definitions.refetch()])}>{t("common.retry")}</button></div>;
    if ((!isNew && page.isPending) || pages.isPending || config.isPending || content.isPending || definitions.isPending) return <EventLoading event={event} label={t("manage.content.page.loading")} />;

    const settings = <div className={`event-manage-page-details${detailsOpen ? "" : " is-collapsed"}`} aria-label={t("manage.content.page.settings")}>
        <button className="event-manage-page-details__toggle" type="button" aria-expanded={detailsOpen} aria-controls={detailsID} onClick={() => setDetailsOpen(open => !open)}><span><strong>{t("manage.content.page.settings")}</strong><small>{draft.Title || t("manage.content.page.new")} · {draft.Visibility === 2 ? t("manage.content.page.visibilityModerators") : draft.Visibility === 1 ? t("manage.content.page.visibilityParticipants") : t("manage.content.page.visibilityPublic")}</small></span><ChevronDown size={18} aria-hidden="true" /></button>
        {detailsOpen && <div className="event-manage-page-details__fields" id={detailsID}>
            <div className="event-manage-field"><FieldLabel label={t("manage.content.page.title")} required help={t("manage.content.page.titleHelp")} /><input className={`event-manage-input${titleError ? " is-invalid" : ""}`} aria-label={t("manage.content.page.title")} aria-invalid={!!titleError} aria-describedby={titleError ? `${detailsID}-title-error` : undefined} value={draft.Title} required disabled={!canManage || !!busy} onChange={e => change({...draft, Title: e.target.value})} maxLength={255} />{titleError && <p className="event-content-editor__field-error" id={`${detailsID}-title-error`} role="alert">{titleError}</p>}</div>
            <div className="event-manage-field"><FieldLabel label={t("manage.content.page.slug")} required help={t("manage.content.page.slugHelp")} /><div className="event-manage-page-slug"><span>/</span><input className={`event-manage-input${slugError ? " is-invalid" : ""}`} aria-label={t("manage.content.page.slugLabel")} aria-invalid={!!slugError} aria-describedby={slugError ? `${detailsID}-slug-error` : undefined} value={draft.Slug} required disabled={!canManage || !!busy} onChange={e => change({...draft, Slug: e.target.value.toLowerCase()})} maxLength={128} /></div>{slugError && <p className="event-content-editor__field-error" id={`${detailsID}-slug-error`} role="alert">{slugError}</p>}</div>
            <div className="event-manage-field"><FieldLabel label={t("manage.content.page.access")} required help={t("manage.content.page.accessHelp")} /><EventSelect ariaLabel={t("manage.content.page.accessLabel")} value={String(draft.Visibility)} disabled={!canManage || !!busy} options={[{value: "0", label: t("manage.content.page.visibilityPublic")}, {value: "1", label: t("manage.content.page.visibilityParticipants")}, {value: "2", label: t("manage.content.page.visibilityModerators")}]} onValueChange={value => {const visibility = Number(value) as 0 | 1 | 2; change({...draft, Visibility: visibility, Navigation: visibility === 2 ? 0 : draft.Navigation});}} /></div>
            <div className="event-manage-field"><FieldLabel label={t("manage.content.page.menu")} required help={t("manage.content.page.menuHelp")} /><EventSelect ariaLabel={t("manage.content.page.menuLabel")} value={draft.Visibility === 2 || draft.Navigation === 0 ? "0" : "1"} disabled={!canManage || !!busy || draft.Visibility === 2} options={[{value: "1", label: t("manage.content.page.menuShow")}, {value: "0", label: t("manage.content.page.menuHide")}]} onValueChange={value => change({...draft, Navigation: value === "1" ? 1 : 0})} /></div>
            <div className="event-manage-field"><FieldLabel label={t("manage.content.page.after")} required={draft.Navigation !== 0 && draft.Visibility !== 2} help={t("manage.content.page.afterHelp")} /><EventSelect ariaLabel={t("manage.content.page.afterLabel")} value={shownPlacement} disabled={!canManage || !!busy || draft.Navigation === 0 || draft.Visibility === 2} options={[{value: "first", label: t("manage.content.page.afterFirst")}, {value: "challenges", label: t("manage.content.page.afterChallenges")}, {value: "results", label: t("manage.content.page.afterResults"), disabled: !scoreboardShown, disabledReason: !scoreboardShown ? t("manage.content.page.resultsHidden") : undefined}, ...existingPages.filter(item => item.ID !== page.data?.ID).map(item => ({value: item.ID, label: t("manage.content.page.afterPage", {title: item.Title}), disabled: item.Navigation === 0 || !item.PublishedAt, disabledReason: !item.PublishedAt ? t("manage.content.page.notPublished") : item.Visibility === 2 ? t("manage.content.page.moderatorsOnly") : item.Navigation === 0 ? t("manage.content.page.notInMenu") : undefined}))]} onValueChange={value => change({...draft, NavigationAfter: value})} /></div>
        </div>}
    </div>;

    return <div className="event-manage-content">
        <header className="event-manage-heading"><div><p className="event-manage-eyebrow">{t("manage.content.page.eyebrow")}</p><h1>{isNew ? t("manage.content.page.new") : draft.Title}</h1><p>{t("manage.content.page.lead")}</p></div><div className="event-manage-heading__actions">{page.data && published ? <EventTooltip content={t("manage.content.page.openTip")}>{tipID => <Link className="ib-btn event-manage-icon-action" href={`/${page.data.Slug}`} target="_blank" aria-label={t("manage.content.page.open")} aria-describedby={tipID}><ArrowUpRight size={17} /></Link>}</EventTooltip> : <EventTooltip content={t("manage.content.page.openDisabledTip")}>{tipID => <button className="ib-btn event-manage-icon-action" type="button" aria-label={t("manage.content.page.open")} aria-describedby={tipID} disabled><ArrowUpRight size={17} /></button>}</EventTooltip>}{!isNew && canManage && <EventTooltip content={t("manage.content.page.deleteTip")}>{tipID => <button className="ib-btn ib-btn--danger event-manage-icon-action" type="button" aria-label={t("manage.content.page.delete")} aria-describedby={tipID} disabled={!!busy} onClick={() => setDeleteOpen(true)}><Trash2 size={17} /></button>}</EventTooltip>}</div></header>
        <DraftBar state={{dirty, hasDraft: !!page.data?.Draft, published}} busy={busy} canManage={canManage} invalid={!!validation}
            onSave={() => void save()} onPublish={() => void publish()} onRevertLocal={() => setEdited(null)} onDiscardDraft={() => void discardDraft()} />
        <BlockStackEditor editorKey={`${eventID}:${key}`} eventID={eventID} coverImage={event.PreviewPicture ?? ""} document={draft.Document} catalog={catalog} values={values} validation={documentError}
            canEdit={canManage && !busy} pageVisibility={draft.Visibility} previewTitle={draft.Title || t("manage.content.page.new")} before={settings} onChange={changeDocument} />
        <Dialog open={deleteOpen} onOpenChange={open => {if (!busy) setDeleteOpen(open);}}><DialogContent className="event-page-delete-dialog"><DialogHeader><DialogTitle>{t("manage.content.page.deleteTitle", {title: page.data?.Title ?? ""})}</DialogTitle><DialogDescription>{t("manage.content.page.deleteBody")}</DialogDescription></DialogHeader><div className="event-page-delete-dialog__actions"><button className="ib-btn" type="button" disabled={!!busy} onClick={() => setDeleteOpen(false)}>{t("manage.content.page.keep")}</button><EventButton className="ib-btn ib-btn--danger-solid" type="button" disabled={!!busy} onClick={() => void remove()} busy={!!busy}>{t("manage.content.page.delete")}</EventButton></div></DialogContent></Dialog>
    </div>;
}
