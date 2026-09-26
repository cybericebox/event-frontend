"use client";

import {useState, type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {CircleHelp} from "lucide-react";
import {toast} from "react-hot-toast";
import {getManageConfig, getManageName, ManageApiError, putManageGeneral} from "@/api/manage";
import {BrandDraftField, useBrandDraft} from "@/components/event/manage/BrandDraftField";
import {useManager} from "@/components/event/manage/ManagerShell";
import {EventLoading} from "@/components/event/EventLoading";
import {EventTooltip} from "@/components/ui/EventTooltip";

function FieldLabel({htmlFor, title, help, required = false}: {htmlFor: string; title: string; help: string; required?: boolean}) {
    return <div className="event-brand-field__head"><label htmlFor={htmlFor}>{title}{required && <span className="event-field-required" aria-label="Обов’язкове поле">*</span>}</label><EventTooltip content={<span className="event-brand-tooltip-copy">{help}</span>}>{id => <button className="event-brand-help" type="button" aria-label={`Про поле «${title}»`} aria-describedby={id}><CircleHelp size={15} /></button>}</EventTooltip></div>;
}

export default function ManageGeneralPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const router = useRouter();
    const queryClient = useQueryClient();
    const nameQuery = useQuery({queryKey: ["event-management-name", eventID], queryFn: () => getManageName(eventID), refetchOnWindowFocus: false});
    const configQuery = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const [nameEdit, setNameEdit] = useState<{eventID: string; value: string} | null>(null);
    const [descriptionEdit, setDescriptionEdit] = useState<{eventID: string; value: string} | null>(null);
    const [saving, setSaving] = useState(false);
    const name = nameEdit?.eventID === eventID ? nameEdit.value : nameQuery.data?.Name ?? "";
    const description = descriptionEdit?.eventID === eventID ? descriptionEdit.value : configQuery.data?.PreviewDescription ?? "";
    const preview = useBrandDraft(eventID, "preview", configQuery.data?.PreviewPicture ?? "", 5 << 20);
    const dirty = !!nameQuery.data && !!configQuery.data && (name.trim() !== nameQuery.data.Name || description !== configQuery.data.PreviewDescription || preview.dirty);
    const disabled = !canManage || saving;

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!name.trim() || preview.uploading) return;
        setSaving(true);
        try {
            const result = await putManageGeneral(eventID, {Name: name.trim(), Description: description, Preview: preview.change});
            queryClient.setQueryData(["event-management-name", eventID], {Name: result.Name});
            queryClient.setQueryData(["event-management-config", eventID], result.Config);
            queryClient.setQueryData<PublicEventInfo>(["event-manager-public-info"], current =>
                current?.EventID === eventID ? {...current, Name: result.Name, PreviewDescription: result.Config.PreviewDescription, PreviewPicture: result.Config.PreviewPicture} : current
            );
            setNameEdit(null); setDescriptionEdit(null); preview.saved(result.Config.PreviewPicture);
            toast.success("Загальне збережено");
            router.refresh();
        } catch (error) {
            toast.error(error instanceof ManageApiError && error.status === 409 ? "Дані змінилися. Оновіть сторінку й повторіть." : "Не вдалося зберегти загальні налаштування.");
        } finally {setSaving(false);}
    }

    if (nameQuery.isPending || configQuery.isPending) return <EventLoading event={event} />;
    if (nameQuery.isError || configQuery.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити налаштування</h1><button className="ib-btn" onClick={() => {void nameQuery.refetch(); void configQuery.refetch();}}>Повторити</button></div>;
    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>Загальне</h1><p>Назва, короткий опис і зображення прев’ю події.</p></div></header>
        {!canManage && <p className="event-manage-notice">Доступний лише перегляд.</p>}
        <section className="event-manage-section">
            <div className="event-manage-field"><FieldLabel htmlFor="event-name" title="Назва події" help={"Публічна назва події.\nВідображається в навігації та на сторінках."} required /><input id="event-name" className="event-manage-input" value={name} onChange={change => setNameEdit({eventID, value: change.target.value})} maxLength={255} required disabled={disabled} /></div>
            <div className="event-manage-field"><FieldLabel htmlFor="event-description" title="Короткий опис" help={"Текст про подію.\nВикористовується в картці події та під час поширення посилання."} /><textarea id="event-description" className="event-manage-input" value={description} onChange={change => setDescriptionEdit({eventID, value: change.target.value})} maxLength={1000} rows={3} disabled={disabled} /></div>
            <BrandDraftField id="event-preview-picture" title="Зображення прев’ю" help="Зображення для картки події та посилання. До збереження бачите лише чернетку." hint="PNG, JPEG або WebP до 5 МБ · рекомендоване співвідношення 2:1" kind="preview" draft={preview} disabled={disabled} />
        </section>
        {(dirty || saving) && <div className="event-manage-savebar"><button className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !name.trim() || preview.uploading}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div>}
    </form>;
}
