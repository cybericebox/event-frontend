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
    const slugError = reservedPageSlugs.has(draft.Slug) ? `Адреса /${draft.Slug} зарезервована для системної сторінки.` :
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.Slug) || draft.Slug.length > 128 ? "Адреса сторінки: латинські літери, цифри й дефіси." :
        slugTaken ? "Ця адреса вже використовується іншою сторінкою." :
        null;
    const titleError = !draft.Title.trim() || draft.Title.length > 255 ? "Вкажіть назву сторінки до 255 символів." : null;
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

    function failure(error: unknown, action: string) {
        const status = error instanceof ManageApiError ? error.status : 0;
        toast.error(status === 400 ? "Сервер відхилив поля або змінні сторінки." : status === 409 ? "Адреса зайнята або сторінку змінили в іншій вкладці. Оновіть сторінку." : status === 404 ? "Чернетку вже опубліковано або скасовано. Оновіть сторінку." : `Не вдалося ${action}. Повторіть запит.`);
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
            toast.success(isNew ? "Сторінку створено як чернетку" : "Чернетку збережено. На сайті — попередня версія.");
            const editorSlug = result.Draft?.Slug ?? result.Slug;
            if (editorSlug !== slug) router.replace(`/manage/content/pages/${editorSlug}`);
        } catch (error) { failure(error, "зберегти чернетку"); } finally { setBusy(null); }
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
            toast.success("Сторінку опубліковано");
            if (result.Slug !== slug) router.replace(`/manage/content/pages/${result.Slug}`);
        } catch (error) { failure(error, "опублікувати сторінку"); } finally { setBusy(null); }
    }

    async function discardDraft() {
        if (!canManage || busy || !page.data) return;
        setBusy("discard");
        try {
            await discardManagePageDraft(eventID, page.data.ID);
            await refresh();
            setEdited(null);
            toast.success("Неопубліковані зміни скасовано");
            if (page.data.Slug !== slug) router.replace(`/manage/content/pages/${page.data.Slug}`);
        } catch (error) { failure(error, "скасувати зміни"); } finally { setBusy(null); }
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
            toast.success("Сторінку видалено");
            router.replace("/manage/content/landing");
        } catch {
            toast.error("Не вдалося видалити сторінку. Повторіть спробу.");
            setBusy(null);
        }
    }

    if (page.isError || pages.isError || config.isError || content.isError || definitions.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити сторінку</h1><button className="ib-btn" onClick={() => void Promise.all([page.refetch(), pages.refetch(), config.refetch(), content.refetch(), definitions.refetch()])}>Повторити</button></div>;
    if ((!isNew && page.isPending) || pages.isPending || config.isPending || content.isPending || definitions.isPending) return <EventLoading event={event} label="Завантажуємо редактор…" />;

    const settings = <div className={`event-manage-page-details${detailsOpen ? "" : " is-collapsed"}`} aria-label="Налаштування сторінки">
        <button className="event-manage-page-details__toggle" type="button" aria-expanded={detailsOpen} aria-controls={detailsID} onClick={() => setDetailsOpen(open => !open)}><span><strong>Налаштування сторінки</strong><small>{draft.Title || "Нова сторінка"} · {draft.Visibility === 2 ? "Лише модератори" : draft.Visibility === 1 ? "Підтверджені учасники" : "Публічна"}</small></span><ChevronDown size={18} aria-hidden="true" /></button>
        {detailsOpen && <div className="event-manage-page-details__fields" id={detailsID}>
            <div className="event-manage-field"><FieldLabel label="Назва сторінки" required help="Назва додаткової сторінки.\n• Показується у вкладці браузера.\n• Якщо сторінка в меню, також стає назвою пункту меню.\n• На самій сторінці не виводиться — заголовки задають блоки.\nНе більше 255 символів." /><input className={`event-manage-input${titleError ? " is-invalid" : ""}`} aria-label="Назва сторінки" aria-invalid={!!titleError} aria-describedby={titleError ? `${detailsID}-title-error` : undefined} value={draft.Title} required disabled={!canManage || !!busy} onChange={e => change({...draft, Title: e.target.value})} maxLength={255} />{titleError && <p className="event-content-editor__field-error" id={`${detailsID}-title-error`} role="alert">{titleError}</p>}</div>
            <div className="event-manage-field"><FieldLabel label="Адреса" required help="Частина адреси сторінки після /.\n• Латинські літери, цифри та дефіси.\n• Не більше 128 символів.\n• Системні адреси зайняті.\nНова адреса запрацює після публікації, стара тоді перестане працювати." /><div className="event-manage-page-slug"><span>/</span><input className={`event-manage-input${slugError ? " is-invalid" : ""}`} aria-label="Адреса сторінки" aria-invalid={!!slugError} aria-describedby={slugError ? `${detailsID}-slug-error` : undefined} value={draft.Slug} required disabled={!canManage || !!busy} onChange={e => change({...draft, Slug: e.target.value.toLowerCase()})} maxLength={128} /></div>{slugError && <p className="event-content-editor__field-error" id={`${detailsID}-slug-error`} role="alert">{slugError}</p>}</div>
            <div className="event-manage-field"><FieldLabel label="Доступ" required help="Хто може відкрити сторінку.\n• Публічна — усі відвідувачі.\n• Підтверджені учасники — лише учасники події.\n• Лише модератори — сторінки немає в меню сайту." /><EventSelect ariaLabel="Доступ до сторінки" value={String(draft.Visibility)} disabled={!canManage || !!busy} options={[{value: "0", label: "Публічна"}, {value: "1", label: "Підтверджені учасники"}, {value: "2", label: "Лише модератори"}]} onValueChange={value => {const visibility = Number(value) as 0 | 1 | 2; change({...draft, Visibility: visibility, Navigation: visibility === 2 ? 0 : draft.Navigation});}} /></div>
            <div className="event-manage-field"><FieldLabel label="У меню" required help="Чи показувати сторінку в меню сайту (навбарі).\n• Показувати — пункт видно тим, хто має доступ до сторінки.\n• Не показувати — сторінка відкривається лише за прямим посиланням.\nСторінку лише для модераторів у меню не додати." /><EventSelect ariaLabel="Показ у меню" value={draft.Visibility === 2 || draft.Navigation === 0 ? "0" : "1"} disabled={!canManage || !!busy || draft.Visibility === 2} options={[{value: "1", label: "Показувати"}, {value: "0", label: "Не показувати"}]} onValueChange={value => change({...draft, Navigation: value === "1" ? 1 : 0})} /></div>
            <div className="event-manage-field"><FieldLabel label="Після якої сторінки" required={draft.Navigation !== 0 && draft.Visibility !== 2} help="Місце сторінки в меню. Застосовується під час публікації.\n• Першою — перед стандартними й додатковими сторінками.\n• Після «Завдання» — перед результатами.\n• Після «Результати» — якщо їх показ увімкнено для цієї події.\n• Після додаткової сторінки — безпосередньо за нею." /><EventSelect ariaLabel="Після якої сторінки в меню" value={shownPlacement} disabled={!canManage || !!busy || draft.Navigation === 0 || draft.Visibility === 2} options={[{value: "first", label: "Першою"}, {value: "challenges", label: "Після «Завдання»"}, {value: "results", label: "Після «Результати»", disabled: !scoreboardShown, disabledReason: !scoreboardShown ? "Показ результатів вимкнено для цієї події." : undefined}, ...existingPages.filter(item => item.ID !== page.data?.ID).map(item => ({value: item.ID, label: `Після «${item.Title}»`, disabled: item.Navigation === 0 || !item.PublishedAt, disabledReason: !item.PublishedAt ? "Цю сторінку ще не опубліковано." : item.Visibility === 2 ? "Ця сторінка доступна лише модераторам і не показується в меню." : item.Navigation === 0 ? "Цієї сторінки немає в меню." : undefined}))]} onValueChange={value => change({...draft, NavigationAfter: value})} /></div>
        </div>}
    </div>;

    return <div className="event-manage-content">
        <header className="event-manage-heading"><div><p className="event-manage-eyebrow">Сторінки</p><h1>{isNew ? "Нова сторінка" : draft.Title}</h1><p>Той самий конструктор блоків, що й на головній сторінці.</p></div><div className="event-manage-heading__actions">{page.data && published ? <EventTooltip content="Відкрити опубліковану сторінку на сайті">{tipID => <Link className="ib-btn event-manage-icon-action" href={`/${page.data.Slug}`} target="_blank" aria-label="Відкрити сторінку" aria-describedby={tipID}><ArrowUpRight size={17} /></Link>}</EventTooltip> : <EventTooltip content="Опублікуйте сторінку, щоб відкрити її на сайті">{tipID => <button className="ib-btn event-manage-icon-action" type="button" aria-label="Відкрити сторінку" aria-describedby={tipID} disabled><ArrowUpRight size={17} /></button>}</EventTooltip>}{!isNew && canManage && <EventTooltip content="Видалити цю сторінку">{tipID => <button className="ib-btn ib-btn--danger event-manage-icon-action" type="button" aria-label="Видалити сторінку" aria-describedby={tipID} disabled={!!busy} onClick={() => setDeleteOpen(true)}><Trash2 size={17} /></button>}</EventTooltip>}</div></header>
        <DraftBar state={{dirty, hasDraft: !!page.data?.Draft, published}} busy={busy} canManage={canManage} invalid={!!validation}
            onSave={() => void save()} onPublish={() => void publish()} onRevertLocal={() => setEdited(null)} onDiscardDraft={() => void discardDraft()} />
        <BlockStackEditor editorKey={`${eventID}:${key}`} eventID={eventID} coverImage={event.PreviewPicture ?? ""} document={draft.Document} catalog={catalog} values={values} validation={documentError}
            canEdit={canManage && !busy} pageVisibility={draft.Visibility} previewTitle={draft.Title || "Нова сторінка"} before={settings} onChange={changeDocument} />
        <Dialog open={deleteOpen} onOpenChange={open => {if (!busy) setDeleteOpen(open);}}><DialogContent className="event-page-delete-dialog"><DialogHeader><DialogTitle>Видалити сторінку «{page.data?.Title}»?</DialogTitle><DialogDescription>Сторінка зникне із сайту та меню разом із чернеткою. Усі її блоки буде видалено. Цю дію не можна скасувати.</DialogDescription></DialogHeader><div className="event-page-delete-dialog__actions"><button className="ib-btn" type="button" disabled={!!busy} onClick={() => setDeleteOpen(false)}>Залишити сторінку</button><button className="ib-btn ib-btn--danger-solid" type="button" disabled={!!busy} onClick={() => void remove()}>{busy ? "Видаляємо…" : "Видалити сторінку"}</button></div></DialogContent></Dialog>
    </div>;
}
