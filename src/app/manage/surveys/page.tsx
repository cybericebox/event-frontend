"use client";

import {notFound} from "next/navigation";
import {EVENT_FORMS_ENABLED} from "@/utils/features";
import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowDown, ArrowUp, Eye, Plus, Send, Trash2, X} from "lucide-react";
import {EventRichTextEditor} from "@/components/event/manage/EventLexicalEditor";
import {EventRichTextView} from "@/components/event/content/EventRichTextView";
import {emptyRichText} from "@/components/event/content/richTextState";
import {toast} from "react-hot-toast";
import {createManageGenericForm, getManageGenericForms, sendManageGenericForm, updateManageGenericForm, type ManageGenericFormInput} from "@/api/manageFormResponses";
import type {FormBlock, FormField} from "@/api/manageParticipantForm";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {useManager} from "@/components/event/manage/ManagerShell";
import {createFormField, isFormField, validateParticipantForm} from "@/components/event/manage/participantFormEditor";
import {EventSelect} from "@/components/ui/EventSelect";
import {t, tPlural} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {EventCheckbox} from "@/components/ui/EventCheckbox";
import {EventTooltip} from "@/components/ui/EventTooltip";

const emptyForm: ManageGenericFormInput = {Title: "", Enabled: true, Required: false, Document: {blocks: []}};
const inputOptions: {value: FormField["input"]; label: string}[] = [
    {value: "text", label: t("manage.fields.input.text")}, {value: "long_text", label: t("manage.fields.input.longText")},
    {value: "number", label: t("manage.fields.input.number")}, {value: "select", label: t("manage.fields.input.select")},
    {value: "multi_select", label: t("manage.fields.input.multiSelect")}, {value: "checkbox", label: t("manage.fields.input.checkbox")},
];

function Preview({blocks, selectedID}: {blocks: FormBlock[]; selectedID: string}) {
    return <div className="event-form-preview">{blocks.map(block => <div className={`event-form-preview__block${block.id === selectedID ? " is-selected" : ""}`} key={block.id}>
        {block.type === "section" && <h3>{block.label || t("manage.fields.block.section")}</h3>}
        {block.type === "text" && <div className="event-form-preview__text"><EventRichTextView value={block.richText} emptyFallback={t("manage.fields.block.text")} /></div>}
        {block.type === "divider" && <hr />}
        {isFormField(block) && <div className="event-manage-field"><strong>{block.label || t("manage.fields.preview.newQuestion")}{block.required && <span className="event-field-required">*</span>}</strong>{block.help && <small>{block.help}</small>}{block.input === "long_text" ? <textarea className="event-manage-input" rows={3} disabled placeholder={t("manage.fields.preview.participantAnswer")} /> : block.input === "checkbox" ? <EventCheckbox className="event-form-preview__choice" checked={false} disabled label={t("common.yes")} /> : block.input === "select" || block.input === "multi_select" ? <div className="event-form-preview__choices">{(block.options ?? []).map((option, index) => block.input === "select" ? <label className="event-form-preview__choice" key={index}><input type="radio" disabled />{option || t("manage.fields.preview.option", {n: index + 1})}</label> : <EventCheckbox className="event-form-preview__choice" key={index} checked={false} disabled label={option || t("manage.fields.preview.option", {n: index + 1})} />)}</div> : <input className="event-manage-input" type={block.input === "number" ? "number" : "text"} disabled placeholder={t("manage.fields.preview.participantAnswer")} />}</div>}
    </div>)}</div>;
}

function conditionValue(source: FormField): string | number | boolean {
    if (source.input === "number") return 0;
    if (source.input === "checkbox") return true;
    if (source.input === "select") return source.options?.[0] ?? "";
    return "";
}

function SurveyConditionEditor({block, preceding, index, disabled, onChange}: {
    block: FormField; preceding: FormField[]; index: number; disabled: boolean; onChange: (value: FormField) => void;
}) {
    const source = preceding.find(field => field.key === block.condition?.fieldKey);
    return <div className="event-manage-form__condition"><EventSwitch className="event-manage-form__switch" checked={!!block.condition} disabled={disabled || preceding.length === 0} onCheckedChange={checked => {const first = preceding[0]; onChange({...block, condition: checked && first ? {fieldKey: first.key, operator: "equals", value: conditionValue(first)} : undefined});}} label={t("manage.fields.editor.conditional")} />{block.condition && <div className="event-manage-form__condition-fields"><EventSelect ariaLabel={t("manage.fields.editor.conditionSource", {n: index + 1})} value={block.condition.fieldKey} options={preceding.map(field => ({value: field.key, label: field.label || t("manage.fields.editor.untitledQuestion")}))} disabled={disabled} onValueChange={value => {const next = preceding.find(field => field.key === value); if (next) onChange({...block, condition: {fieldKey: value, operator: "equals", value: conditionValue(next)}});}} /><EventSelect ariaLabel={t("manage.fields.editor.conditionOperator", {n: index + 1})} value={block.condition.operator} options={[{value: "equals", label: t("manage.fields.editor.equals")}, {value: "not_equals", label: t("manage.fields.editor.notEquals")}]} disabled={disabled} onValueChange={value => onChange({...block, condition: {...block.condition!, operator: value as "equals" | "not_equals"}})} />{source?.input === "checkbox" ? <EventSelect ariaLabel={t("manage.fields.editor.conditionValue", {n: index + 1})} value={String(block.condition.value)} options={[{value: "true", label: t("common.yes")}, {value: "false", label: t("common.no")}]} disabled={disabled} onValueChange={value => onChange({...block, condition: {...block.condition!, value: value === "true"}})} /> : source?.input === "select" ? <EventSelect ariaLabel={t("manage.fields.editor.conditionValue", {n: index + 1})} value={String(block.condition.value)} options={(source.options ?? []).filter(Boolean).map(value => ({value, label: value}))} disabled={disabled} onValueChange={value => onChange({...block, condition: {...block.condition!, value}})} /> : <input className="event-manage-input" aria-label={t("manage.fields.editor.conditionValue", {n: index + 1})} type={source?.input === "number" ? "number" : "text"} value={String(block.condition.value)} onChange={event => onChange({...block, condition: {...block.condition!, value: source?.input === "number" ? Number(event.target.value) : event.target.value}})} disabled={disabled} placeholder={t("manage.fields.editor.value")} />}</div>}</div>;
}

function SurveysPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const query = useQuery({queryKey: ["event-management-generic-forms", eventID], queryFn: () => getManageGenericForms(eventID), refetchOnWindowFocus: false});
    const [formID, setFormID] = useState("new");
    const [drafts, setDrafts] = useState<Record<string, ManageGenericFormInput>>({});
    const [selectedBlock, setSelectedBlock] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [sending, setSending] = useState(false);
    const form = query.data?.find(item => item.ID === formID);
    const saved: ManageGenericFormInput = form ? {Title: form.Title, Enabled: form.Enabled, Required: form.Required, Document: form.Document} : emptyForm;
    const draft = drafts[formID] ?? saved;
    const blocks = draft.Document.blocks;
    const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
    const validation = !draft.Title.trim() ? t("manage.surveys.validation.title") : !blocks.some(isFormField) ? t("manage.surveys.validation.question") : validateParticipantForm(draft.Document);
    const selectedID = selectedBlock && blocks.some(block => block.id === selectedBlock) ? selectedBlock : null;

    function change(value: ManageGenericFormInput) {setDrafts(current => ({...current, [formID]: value}));}
    function updateBlock(index: number, block: FormBlock) {change({...draft, Document: {blocks: blocks.map((item, position) => position === index ? block : item)}});}
    function add(block: FormBlock) {change({...draft, Document: {blocks: [...blocks, block]}}); setSelectedBlock(block.id);}
    function remove(index: number) {
        const removed = blocks[index];
        change({...draft, Document: {blocks: blocks.filter((_, position) => position !== index).map(block => isFormField(block) && isFormField(removed) && block.condition?.fieldKey === removed.key ? {...block, condition: undefined} : block)}});
        if (selectedBlock === removed.id) setSelectedBlock(null);
    }
    function move(index: number, direction: -1 | 1) {
        const target = index + direction;
        if (target < 0 || target >= blocks.length) return;
        const next = [...blocks]; [next[index], next[target]] = [next[target], next[index]];
        change({...draft, Document: {blocks: next}});
    }
    async function save() {
        if (!canManage || saving || !dirty || validation) return;
        setSaving(true);
        try {
            const result = form ? await updateManageGenericForm(eventID, form.ID, draft) : await createManageGenericForm(eventID, draft);
            queryClient.setQueryData(["event-management-generic-forms", eventID], (current: typeof query.data) => form ? current?.map(item => item.ID === form.ID ? result : item) : [...(current ?? []), result]);
            setDrafts(current => {const next = {...current}; delete next[formID]; return next;});
            setFormID(result.ID);
            toast.success(form ? t("manage.surveys.updated") : t("manage.surveys.created"));
        } catch {toast.error(t("manage.surveys.saveFailed"));}
        finally {setSaving(false);}
    }
    async function send() {
        if (!form || !canManage || sending || dirty || !form.Enabled) return;
        setSending(true);
        try {await sendManageGenericForm(eventID, form.ID); toast.success(t("manage.surveys.sent"));}
        catch {toast.error(t("manage.surveys.sendFailed"));}
        finally {setSending(false);}
    }

    if (query.isPending) return <EventLoading event={event} label={t("manage.surveys.loading")} />;
    if (query.isError) return <EventLoadError message={t("manage.surveys.loadFailed")} onRetry={() => void query.refetch()} />;

    return <div className="event-manage-content event-manage-surveys">
        <header className="event-manage-heading"><div><h1>{t("manage.nav.surveys")}</h1><p>{t("manage.surveys.subtitle")}</p></div><span className="event-attempts-manager__total">{tPlural("manage.surveys.count", query.data.length)}</span></header>
        <div className="event-manage-surveys__layout"><nav className="event-manage-section event-manage-surveys__list" aria-label={t("manage.nav.surveys")}><div className="event-manage-surveys__list-head"><strong>{t("manage.surveys.forms")}</strong>{canManage && <button className="ib-btn ib-btn--sm" type="button" onClick={() => {setFormID("new"); setSelectedBlock(null);}}><Plus size={15} /> {t("manage.surveys.create")}</button>}</div>{query.data.map(item => <button type="button" className={`event-manage-surveys__item${formID === item.ID ? " is-selected" : ""}`} key={item.ID} onClick={() => {setFormID(item.ID); setSelectedBlock(null);}}><strong>{item.Title}</strong><small>{item.Enabled ? t("manage.surveys.itemEnabled", {version: item.Version}) : t("manage.surveys.itemDisabled", {version: item.Version})}</small></button>)}{query.data.length === 0 && <EmptyState compact message={t("manage.surveys.empty")} />}</nav>
            <div className="event-manage-surveys__main"><section className="event-manage-section event-manage-surveys__settings"><div className="event-manage-section__head"><h2>{form ? t("manage.surveys.settings") : t("manage.surveys.new")}</h2>{form && <span>{t("manage.fields.version", {version: form.Version})}</span>}</div><label className="event-manage-field"><span>{t("manage.surveys.title")}<span className="event-field-required">*</span></span><input className="event-manage-input" value={draft.Title} onChange={e => change({...draft, Title: e.target.value})} disabled={!canManage || saving} placeholder={t("manage.surveys.titlePlaceholder")} /></label><div className="event-manage-fields-two"><div className="event-manage-field"><ManageFieldLabel title={t("manage.surveys.show")} help={t("manage.surveys.showHelp")} /><EventSwitch className="event-manage-form__switch" checked={draft.Enabled} onCheckedChange={checked => change({...draft, Enabled: checked, Required: checked && draft.Required})} disabled={!canManage || saving} label={t("manage.surveys.enabled")} /></div><div className="event-manage-field"><ManageFieldLabel title={t("manage.surveys.required")} help={t("manage.surveys.requiredHelp")} /><EventSwitch className="event-manage-form__switch" checked={draft.Required} onCheckedChange={checked => change({...draft, Required: checked})} disabled={!canManage || saving || !draft.Enabled} label={t("manage.surveys.requireAnswer")} /></div></div></section>
                <div className={`event-manage-content__layout${selectedID ? "" : " event-manage-content__layout--single"}`}><div className="event-content-editor"><div className="event-content-editor__top"><div><h2>{t("manage.fields.editor.title")}</h2><p>{t("manage.surveys.editorSubtitle")}</p></div><span>{blocks.length}</span></div>{blocks.length === 0 && <EmptyState message={t("manage.surveys.emptyForm")} />}<div className="event-content-editor__stack">{blocks.map((block, index) => <section className={`event-content-editor__block${selectedID === block.id ? " is-selected" : ""}`} key={block.id} onClick={() => setSelectedBlock(block.id)} onFocusCapture={() => setSelectedBlock(block.id)}><div className="event-content-editor__block-head"><div className="event-content-editor__block-title"><span className="event-content-editor__order">{index + 1}</span><strong>{isFormField(block) ? t("manage.fields.block.question") : block.type === "section" ? t("manage.fields.block.section") : block.type === "text" ? t("manage.fields.block.text") : t("manage.fields.block.divider")}</strong></div>{canManage && <div className="event-content-editor__block-actions"><EventTooltip content={t("manage.fields.editor.moveUp", {n: index + 1})} silent>{() => <button type="button" aria-label={t("manage.fields.editor.moveUp", {n: index + 1})} disabled={index === 0 || saving} onClick={() => move(index, -1)}><ArrowUp size={16} /></button>}</EventTooltip><EventTooltip content={t("manage.fields.editor.moveDown", {n: index + 1})} silent>{() => <button type="button" aria-label={t("manage.fields.editor.moveDown", {n: index + 1})} disabled={index === blocks.length - 1 || saving} onClick={() => move(index, 1)}><ArrowDown size={16} /></button>}</EventTooltip><EventTooltip content={t("manage.fields.editor.delete", {n: index + 1})} silent>{() => <button className="event-content-editor__danger" type="button" aria-label={t("manage.fields.editor.delete", {n: index + 1})} disabled={saving} onClick={() => remove(index)}><Trash2 size={16} /></button>}</EventTooltip></div>}</div><div className="event-content-editor__block-body">{isFormField(block) ? <><label className="event-manage-field"><span>{t("manage.fields.block.question")}<span className="event-field-required">*</span></span><input className="event-manage-input" value={block.label} onChange={e => updateBlock(index, {...block, label: e.target.value})} disabled={!canManage || saving} placeholder={t("manage.fields.editor.questionPlaceholder")} /></label><div className="event-manage-fields-two"><div className="event-manage-field"><span>{t("manage.fields.editor.answerType")}</span><EventSelect ariaLabel={t("manage.fields.editor.answerTypeFor", {n: index + 1})} value={block.input} options={inputOptions} disabled={!canManage || saving} onValueChange={value => updateBlock(index, {...block, input: value as FormField["input"], options: value === "select" || value === "multi_select" ? block.options?.length ? block.options : [""] : undefined})} /></div><label className="event-manage-field"><span>{t("manage.surveys.hint")}</span><input className="event-manage-input" value={block.help ?? ""} onChange={e => updateBlock(index, {...block, help: e.target.value})} disabled={!canManage || saving} placeholder={t("manage.fields.editor.optional")} /></label></div>{(block.input === "select" || block.input === "multi_select") && <label className="event-manage-field"><span>{t("manage.fields.editor.options")}<span className="event-field-required">*</span></span><textarea className="event-manage-input" rows={3} value={(block.options ?? []).join("\n")} onChange={e => updateBlock(index, {...block, options: e.target.value.split("\n")})} disabled={!canManage || saving} placeholder={t("manage.fields.editor.optionsPlaceholder")} /></label>}<EventSwitch className="event-manage-form__switch" checked={!!block.required} onCheckedChange={checked => updateBlock(index, {...block, required: checked})} disabled={!canManage || saving} label={t("manage.fields.editor.answerRequired")} /><SurveyConditionEditor block={block} preceding={blocks.slice(0, index).filter(isFormField).filter(field => field.input !== "multi_select")} index={index} disabled={!canManage || saving} onChange={value => updateBlock(index, value)} /></> : block.type === "section" ? <label className="event-manage-field"><span>{t("manage.fields.block.section")}<span className="event-field-required">*</span></span><input className="event-manage-input" value={block.label ?? ""} onChange={e => updateBlock(index, {...block, label: e.target.value})} disabled={!canManage || saving} /></label> : block.type === "text" ? <div className="event-manage-field"><span>{t("manage.fields.block.text")}<span className="event-field-required">*</span></span><EventRichTextEditor value={block.richText ?? emptyRichText()} onChange={value => updateBlock(index, {...block, richText: value})} variables={[]} values={{}} disabled={!canManage || saving} ariaLabel={t("manage.fields.block.text")} /></div> : <p>{t("manage.fields.editor.dividerNote")}</p>}</div></section>)}</div>{canManage && <div className="event-content-editor__add" aria-label={t("manage.surveys.addBlock")}><button className="ib-btn" type="button" onClick={() => add(createFormField())}><Plus size={16} /> {t("manage.fields.block.question")}</button><button className="ib-btn" type="button" onClick={() => add({id: `section-${crypto.randomUUID()}`, type: "section", label: ""})}><Plus size={16} /> {t("manage.fields.block.section")}</button><button className="ib-btn" type="button" onClick={() => add({id: `text-${crypto.randomUUID()}`, type: "text", richText: emptyRichText()})}><Plus size={16} /> {t("manage.fields.block.text")}</button><button className="ib-btn" type="button" onClick={() => add({id: `divider-${crypto.randomUUID()}`, type: "divider"})}><Plus size={16} /> {t("manage.fields.block.divider")}</button></div>}{validation && (dirty || formID === "new") && <p className="event-manage-validation" role="alert">{validation}</p>}{dirty && <div className="event-content-editor__footer"><span>{t("manage.fields.unsavedChanges")}</span><div><button className="ib-btn" type="button" onClick={() => setDrafts(current => {const next = {...current}; delete next[formID]; return next;})} disabled={saving}>{t("common.cancel")}</button><EventButton className="ib-btn ib-btn--primary" type="button" disabled={!canManage || saving || !!validation} onClick={() => void save()} busy={saving}>{form ? t("manage.surveys.saveVersion") : t("manage.surveys.createSurvey")}</EventButton></div></div>}</div>{selectedID && <aside className="event-manage-content__preview" aria-label={t("manage.surveys.previewLabel")}><div className="event-manage-content__preview-head"><Eye size={17} /><div><h2>{t("manage.fields.preview.title")}</h2><p>{t("manage.surveys.previewSubtitle")}</p></div><EventTooltip content={t("manage.surveys.closePreview")} silent>{() => <button className="event-manage-content__preview-close" type="button" aria-label={t("manage.surveys.closePreview")} onClick={() => setSelectedBlock(null)}><X size={17} /></button>}</EventTooltip></div><div className="event-manage-content__preview-window"><Preview blocks={blocks} selectedID={selectedID} /></div></aside>}</div>
                {form && <section className="event-manage-section event-manage-surveys__send"><div><h2>{t("manage.surveys.sendTitle")}</h2><p>{t("manage.surveys.sendBody")}</p></div><EventButton className="ib-btn" type="button" disabled={!canManage || sending || dirty || !form.Enabled} onClick={() => void send()} busy={sending}><Send size={16} />{t("manage.surveys.sendNow")}</EventButton></section>}
            </div></div>
    </div>;
}

export default function Page() {
    if (!EVENT_FORMS_ENABLED) notFound();
    return <SurveysPage />;
}
