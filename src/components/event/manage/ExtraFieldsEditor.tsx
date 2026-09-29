"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowDown, ArrowUp, Eye, Plus, Trash2} from "lucide-react";
import {EventRichTextEditor} from "@/components/event/manage/EventLexicalEditor";
import {EventRichTextView} from "@/components/event/content/EventRichTextView";
import {emptyRichText} from "@/components/event/content/richTextState";
import {toast} from "react-hot-toast";
import {getManageParticipantForm, putManageParticipantForm, type FormBlock, type FormField, type ParticipantFormInput} from "@/api/manageParticipantForm";
import {getManageTeamFields, putManageTeamFields} from "@/api/manageTeamFields";
import {EventLoading} from "@/components/event/EventLoading";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {useManager} from "@/components/event/manage/ManagerShell";
import {changeInput, createFormField, isChoiceInput, isFormField, removeBlock, validateParticipantForm} from "@/components/event/manage/participantFormEditor";
import {FormConditionEditor, FormFileSettings, FormOptionsEditor} from "@/components/event/manage/FormFieldControls";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {EventSelect} from "@/components/ui/EventSelect";
import {fileRulesText} from "@/components/event/AnswerFileInput";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";

const emptyForm: ParticipantFormInput = {Enabled: false, Required: false, Document: {blocks: []}};
const inputOptions: {value: FormField["input"]; label: string}[] = [
    {value: "text", label: t("manage.fields.input.text")},
    {value: "long_text", label: t("manage.fields.input.longText")},
    {value: "number", label: t("manage.fields.input.number")},
    {value: "select", label: t("manage.fields.input.select")},
    {value: "multi_select", label: t("manage.fields.input.multiSelect")},
    {value: "checkbox", label: t("manage.fields.input.checkbox")},
    {value: "file", label: t("manage.fields.input.file")},
];

function AnswerFilePreview({field}: {field: FormField}) {
    return <div className="event-file-picker"><button className="ib-btn ib-btn--sm" type="button" disabled>{t("manage.invites.file.choose")}</button><span className="event-file-picker__name is-empty">{fileRulesText(field)}</span></div>;
}

function FormPreview({blocks, selectedID, scope}: {blocks: FormBlock[]; selectedID: string | null; scope: "participant" | "team"}) {
    return <div className="event-form-preview">{blocks.map(block => <div className={`event-form-preview__block${block.id === selectedID ? " is-selected" : ""}`} key={block.id}>
        {block.type === "section" && <h3>{block.label || t("manage.fields.block.section")}</h3>}
        {block.type === "text" && <div className="event-form-preview__text"><EventRichTextView value={block.richText} emptyFallback={t("manage.fields.block.text")} /></div>}
        {block.type === "divider" && <hr />}
        {isFormField(block) && <div className="event-manage-field"><strong>{block.label || t("manage.fields.preview.newQuestion")}{block.required && <span className="event-field-required">*</span>}</strong>{block.condition && <small className="event-form-preview__condition">{t("manage.fields.preview.conditional", {question: blocks.find(item => isFormField(item) && item.key === block.condition?.fieldKey)?.label || t("manage.fields.preview.previousQuestion")})}</small>}{block.help && <small>{block.help}</small>}
            {block.input === "long_text" ? <textarea className="event-manage-input" rows={3} disabled placeholder={scope === "team" ? t("manage.fields.preview.teamAnswer") : t("manage.fields.preview.participantAnswer")} /> :
                block.input === "checkbox" ? <label className="event-form-preview__choice"><input type="checkbox" disabled /> {t("common.yes")}</label> :
                block.input === "file" ? <AnswerFilePreview field={block} /> :
                block.input === "select" || block.input === "multi_select" ? <div className="event-form-preview__choices">{(block.options ?? []).map((option, index) => <label className="event-form-preview__choice" key={index}><input type={block.input === "select" ? "radio" : "checkbox"} disabled />{option || t("manage.fields.preview.option", {n: index + 1})}</label>)}</div> :
                <input className="event-manage-input" type={block.input === "number" ? "number" : "text"} disabled placeholder={scope === "team" ? t("manage.fields.preview.teamAnswer") : t("manage.fields.preview.participantAnswer")} />}
        </div>}
        {!isFormField(block) && !["section", "text", "divider"].includes(block.type) && <span>{t("manage.fields.preview.unknownBlock", {type: block.type})}</span>}
    </div>)}{blocks.length === 0 && <EmptyState compact message={t("manage.fields.preview.empty")} />}</div>;
}

export function ExtraFieldsEditor({scope}: {scope: "participant" | "team"}) {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const draftKey = `${eventID}:${scope}`;
    const queryKey = [scope === "team" ? "event-management-team-fields" : "event-management-participant-form", eventID];
    const query = useQuery({queryKey, queryFn: () => scope === "team" ? getManageTeamFields(eventID) : getManageParticipantForm(eventID), refetchOnWindowFocus: false});
    const [edited, setEdited] = useState<Record<string, ParticipantFormInput>>({});
    const [selected, setSelected] = useState<Record<string, string | null>>({});
    const [saving, setSaving] = useState(false);
    const saved: ParticipantFormInput = query.data ? {Enabled: query.data.Enabled, Required: query.data.Required, Document: query.data.Document} : emptyForm;
    const draft = edited[draftKey] ?? saved;
    const blocks = draft.Document.blocks;
    const selectedID = blocks.some(block => block.id === selected[draftKey]) ? selected[draftKey] : null;
    const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
    const validation = validateParticipantForm(draft.Document);

    function change(next: ParticipantFormInput) { setEdited(current => ({...current, [draftKey]: next})); }
    function discard() { setEdited(current => {const next = {...current}; delete next[draftKey]; return next;}); }
    function setBlocks(next: FormBlock[]) { change({...draft, Document: {blocks: next}}); }
    function updateBlock(index: number, block: FormBlock) { setBlocks(blocks.map((item, position) => position === index ? block : item)); }
    function add(block: FormBlock) { change({...draft, Document: {blocks: [...blocks, block]}}); setSelected(current => ({...current, [draftKey]: block.id})); }
    function remove(index: number) { setBlocks(removeBlock(blocks, index)); }
    function move(index: number, direction: -1 | 1) {
        const target = index + direction;
        if (target < 0 || target >= blocks.length) return;
        const next = [...blocks];
        [next[index], next[target]] = [next[target], next[index]];
        change({...draft, Document: {blocks: next}});
    }
    async function save() {
        if (!canManage || saving || !dirty || validation) return;
        setSaving(true);
        try {
            const result = scope === "team" ? await putManageTeamFields(eventID, draft) : await putManageParticipantForm(eventID, draft);
            queryClient.setQueryData(queryKey, result);
            discard();
            toast.success(scope === "team" ? t("manage.fields.savedTeam") : t("manage.fields.savedParticipant"));
        } catch {toast.error(t("manage.fields.saveFailed"));}
        finally {setSaving(false);}
    }

    if (query.isPending) return <EventLoading event={event} label={t("manage.fields.loading")} />;
    if (query.isError) return <div className="event-manage-error" role="alert"><h2>{t("manage.fields.loadFailed")}</h2><button className="ib-btn" type="button" onClick={() => void query.refetch()}>{t("common.retry")}</button></div>;

    return <div className="event-manage-content event-manage-form">
        <div className="event-manage-form__head"><p>{scope === "team" ? t("manage.fields.introTeam") : t("manage.fields.introParticipant")}</p><span className="event-attempts-manager__total">{query.data ? t("manage.fields.version", {version: query.data.Version}) : t("manage.fields.notSaved")}</span></div>
        <section className="event-manage-section event-manage-form__settings"><div className="event-manage-field"><ManageFieldLabel title={t("manage.fields.title")} help={scope === "team" ? t("manage.fields.enabledHelpTeam") : t("manage.fields.enabledHelpParticipant")} /><EventSwitch className="event-manage-form__switch" checked={draft.Enabled} onCheckedChange={checked => change({...draft, Enabled: checked, Required: checked && draft.Required})} disabled={!canManage || saving} label={t("manage.fields.show")} /></div><div className="event-manage-field"><ManageFieldLabel title={t("manage.fields.required")} help={scope === "team" ? t("manage.fields.requiredHelpTeam") : t("manage.fields.requiredHelpParticipant")} /><EventSwitch className="event-manage-form__switch" checked={draft.Required} onCheckedChange={checked => change({...draft, Required: checked})} disabled={!canManage || saving || !draft.Enabled} label={t("manage.fields.requireFill")} /></div></section>
        <div className="event-manage-content__layout"><div className="event-content-editor"><div className="event-content-editor__top"><div><h2>{t("manage.fields.editor.title")}</h2><p>{t("manage.fields.editor.subtitle")}</p></div><span>{blocks.length}</span></div>
            {blocks.length === 0 && <EmptyState message={t("manage.fields.editor.empty")} />}
            <div className="event-content-editor__stack">{blocks.map((block, index) => {
                return <section className={`event-content-editor__block${selectedID === block.id ? " is-selected" : ""}`} key={block.id} onClick={() => setSelected(current => ({...current, [draftKey]: block.id}))} onFocusCapture={() => setSelected(current => ({...current, [draftKey]: block.id}))}>
                    <div className="event-content-editor__block-head"><div className="event-content-editor__block-title"><span className="event-content-editor__order">{index + 1}</span><strong>{isFormField(block) ? t("manage.fields.block.question") : block.type === "section" ? t("manage.fields.block.section") : block.type === "text" ? t("manage.fields.block.text") : block.type === "divider" ? t("manage.fields.block.divider") : block.type}</strong></div>{canManage && <div className="event-content-editor__block-actions"><button type="button" aria-label={t("manage.fields.editor.moveUp", {n: index + 1})} disabled={index === 0 || saving} onClick={() => move(index, -1)}><ArrowUp size={16} /></button><button type="button" aria-label={t("manage.fields.editor.moveDown", {n: index + 1})} disabled={index === blocks.length - 1 || saving} onClick={() => move(index, 1)}><ArrowDown size={16} /></button><button className="event-content-editor__danger" type="button" aria-label={t("manage.fields.editor.delete", {n: index + 1})} disabled={saving} onClick={() => remove(index)}><Trash2 size={16} /></button></div>}</div>
                    <div className="event-content-editor__block-body">{isFormField(block) ? <>
                        <label className="event-manage-field"><span>{t("manage.fields.block.question")}<span className="event-field-required">*</span></span><input className="event-manage-input" value={block.label} onChange={e => updateBlock(index, {...block, label: e.target.value})} disabled={!canManage || saving} placeholder={t("manage.fields.editor.questionPlaceholder")} /></label>
                        <div className="event-manage-fields-two"><div className="event-manage-field"><span>{t("manage.fields.editor.answerType")}</span><EventSelect ariaLabel={t("manage.fields.editor.answerTypeFor", {n: index + 1})} value={block.input} options={inputOptions} disabled={!canManage || saving} onValueChange={value => setBlocks(changeInput(blocks, index, value as FormField["input"]))} /></div><label className="event-manage-field"><span>{scope === "team" ? t("manage.fields.editor.helpTeam") : t("manage.fields.editor.helpParticipant")}</span><input className="event-manage-input" value={block.help ?? ""} onChange={e => updateBlock(index, {...block, help: e.target.value})} disabled={!canManage || saving} placeholder={t("manage.fields.editor.optional")} /></label></div>
                        {isChoiceInput(block.input) && <FormOptionsEditor blocks={blocks} index={index} disabled={!canManage || saving} onChange={setBlocks} />}
                        {block.input === "file" && <FormFileSettings blocks={blocks} index={index} disabled={!canManage || saving} onChange={setBlocks} />}
                        <div className="event-manage-form__switches"><EventSwitch className="event-manage-form__switch" checked={!!block.required} onCheckedChange={checked => updateBlock(index, {...block, required: checked})} disabled={!canManage || saving} label={t("manage.fields.editor.answerRequired")} />
                        <EventSwitch className="event-manage-form__switch" checked={!!block.editable} onCheckedChange={checked => updateBlock(index, {...block, editable: checked || undefined})} disabled={!canManage || saving} label={scope === "team" ? t("manage.fields.editor.editableTeam") : t("manage.fields.editor.editableParticipant")} /></div>
                        <FormConditionEditor blocks={blocks} index={index} disabled={!canManage || saving} onChange={setBlocks} />
                    </> : block.type === "section" ? <label className="event-manage-field"><span>{t("manage.fields.block.section")}<span className="event-field-required">*</span></span><input className="event-manage-input" value={block.label ?? ""} onChange={e => updateBlock(index, {...block, label: e.target.value})} disabled={!canManage || saving} /></label> : block.type === "text" ? <div className="event-manage-field"><span>{t("manage.fields.block.text")}<span className="event-field-required">*</span></span><EventRichTextEditor value={block.richText ?? emptyRichText()} onChange={value => updateBlock(index, {...block, richText: value})} variables={[]} values={{}} disabled={!canManage || saving} ariaLabel={t("manage.fields.block.text")} /></div> : block.type === "divider" ? <p>{t("manage.fields.editor.dividerNote")}</p> : <p>{t("manage.fields.editor.unsupported")}</p>}</div>
                </section>;
            })}</div>
            {canManage && <div className="event-content-editor__add" aria-label={t("manage.fields.editor.addBlock")}><button className="ib-btn" type="button" onClick={() => add(createFormField())}><Plus size={16} /> {t("manage.fields.editor.addField")}</button><button className="ib-btn" type="button" onClick={() => add({id: `section-${crypto.randomUUID()}`, type: "section", label: ""})}><Plus size={16} /> {t("manage.fields.block.section")}</button><button className="ib-btn" type="button" onClick={() => add({id: `text-${crypto.randomUUID()}`, type: "text", richText: emptyRichText()})}><Plus size={16} /> {t("manage.fields.block.text")}</button><button className="ib-btn" type="button" onClick={() => add({id: `divider-${crypto.randomUUID()}`, type: "divider"})}><Plus size={16} /> {t("manage.fields.block.divider")}</button></div>}
            {validation && <p className="event-manage-validation" role="alert">{validation}</p>}
            {(dirty || saving) && <div className="event-content-editor__footer"><span>{t("manage.fields.unsavedChanges")}</span><div><button className="ib-btn" type="button" onClick={discard} disabled={saving}>{t("common.cancel")}</button><EventButton className="ib-btn ib-btn--primary" type="button" disabled={!canManage || saving || !!validation} onClick={() => void save()} busy={saving}>{t("manage.fields.save")}</EventButton></div></div>}
        </div><aside className="event-manage-content__preview" aria-label={t("manage.fields.preview.label")}><div className="event-manage-content__preview-head"><Eye size={17} /><div><h2>{t("manage.fields.preview.title")}</h2><p>{t("manage.fields.preview.subtitle")}</p></div></div><div className="event-manage-content__preview-window"><FormPreview blocks={blocks} selectedID={selectedID} scope={scope} /></div></aside></div>
    </div>;
}
