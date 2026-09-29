"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {Eye, Plus} from "lucide-react";
import {EventRichTextView} from "@/components/event/content/EventRichTextView";
import {emptyRichText} from "@/components/event/content/richTextState";
import {toast} from "react-hot-toast";
import {getManageParticipantForm, putManageParticipantForm, type FormBlock, type FormField, type ParticipantFormInput} from "@/api/manageParticipantForm";
import {getManageTeamFields, putManageTeamFields} from "@/api/manageTeamFields";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {useManager} from "@/components/event/manage/ManagerShell";
import {createFormField, duplicateBlock, isFormField, participantFormProblem, removeBlock} from "@/components/event/manage/participantFormEditor";
import {FormBlockCard, type FieldsScope} from "@/components/event/manage/FormBlockCard";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {fileRulesText} from "@/components/event/AnswerFileInput";
import {t} from "@/i18n/t";
import {EmptyState} from "@/components/ui/EmptyState";
import {EventButton} from "@/components/ui/EventButton";

const emptyForm: ParticipantFormInput = {Enabled: false, Required: false, Document: {blocks: []}};

function AnswerFilePreview({field}: {field: FormField}) {
    return <div className="event-file-picker"><button className="ib-btn ib-btn--sm" type="button" disabled>{t("ui.filePicker.choose")}</button><span className="event-file-picker__name is-empty">{fileRulesText(field)}</span></div>;
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

export function ExtraFieldsEditor({scope}: {scope: FieldsScope}) {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const draftKey = `${eventID}:${scope}`;
    const queryKey = [scope === "team" ? "event-management-team-fields" : "event-management-participant-form", eventID];
    const query = useQuery({queryKey, queryFn: () => scope === "team" ? getManageTeamFields(eventID) : getManageParticipantForm(eventID), refetchOnWindowFocus: false});
    const [edited, setEdited] = useState<Record<string, ParticipantFormInput>>({});
    const [selected, setSelected] = useState<Record<string, string | null>>({});
    const [saving, setSaving] = useState(false);
    // Open cards by block id (per form), so moving a card keeps its state.
    // While a card is dragged every card renders collapsed; the set is kept.
    const [openBlocks, setOpenBlocks] = useState<{key: string; ids: string[]}>({key: draftKey, ids: []});
    const [dragging, setDragging] = useState(false);
    const [expandedError, setExpandedError] = useState("");
    const saved: ParticipantFormInput = query.data ? {Enabled: query.data.Enabled, Required: query.data.Required, Document: query.data.Document} : emptyForm;
    const draft = edited[draftKey] ?? saved;
    const blocks = draft.Document.blocks;
    const selectedID = blocks.some(block => block.id === selected[draftKey]) ? selected[draftKey] : null;
    const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
    const problem = participantFormProblem(draft.Document);
    const validation = problem?.message ?? null;
    const openIDs = openBlocks.key === draftKey ? openBlocks.ids : [];
    // A card with a new validation error opens once; the author may close it
    // again and its red outline stays as the indicator.
    const invalidID = problem ? blocks[problem.index]?.id : undefined;
    const errorKey = invalidID ? `${draftKey}|${invalidID}|${validation}` : "";
    if (errorKey !== expandedError) {
        setExpandedError(errorKey);
        if (invalidID && !openIDs.includes(invalidID)) setOpenBlocks({key: draftKey, ids: [...openIDs, invalidID]});
    }

    function change(next: ParticipantFormInput) { setEdited(current => ({...current, [draftKey]: next})); }
    function discard() { setEdited(current => {const next = {...current}; delete next[draftKey]; return next;}); }
    function setBlocks(next: FormBlock[]) { change({...draft, Document: {blocks: next}}); }
    function setOpen(blockIDs: string[]) { setOpenBlocks({key: draftKey, ids: blockIDs}); }
    function setBlockOpen(blockID: string, open: boolean) {
        const ids = openIDs.filter(id => id !== blockID);
        setOpen(open ? [...ids, blockID] : ids);
    }
    function add(block: FormBlock) { change({...draft, Document: {blocks: [...blocks, block]}}); setSelected(current => ({...current, [draftKey]: block.id})); setBlockOpen(block.id, true); }
    function duplicate(index: number) {
        const result = duplicateBlock(blocks, index);
        if (!result) return;
        setBlocks(result.blocks);
        setSelected(current => ({...current, [draftKey]: result.copy.id}));
        setBlockOpen(result.copy.id, true);
    }
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
    if (query.isError) return <EventLoadError message={t("manage.fields.loadFailed")} onRetry={() => void query.refetch()} />;

    return <div className="event-manage-content event-manage-form">
        <div className="event-manage-form__head"><p>{scope === "team" ? t("manage.fields.introTeam") : t("manage.fields.introParticipant")}</p><span className="event-attempts-manager__total">{query.data ? t("manage.fields.version", {version: query.data.Version}) : t("manage.fields.notSaved")}</span></div>
        <section className="event-manage-section event-manage-form__settings"><div className="event-manage-field"><ManageFieldLabel title={t("manage.fields.title")} help={scope === "team" ? t("manage.fields.enabledHelpTeam") : t("manage.fields.enabledHelpParticipant")} /><EventSwitch className="event-manage-form__switch" checked={draft.Enabled} onCheckedChange={checked => change({...draft, Enabled: checked, Required: checked && draft.Required})} disabled={!canManage || saving} label={t("manage.fields.show")} /></div><div className="event-manage-field"><ManageFieldLabel title={t("manage.fields.required")} help={scope === "team" ? t("manage.fields.requiredHelpTeam") : t("manage.fields.requiredHelpParticipant")} /><EventSwitch className="event-manage-form__switch" checked={draft.Required} onCheckedChange={checked => change({...draft, Required: checked})} disabled={!canManage || saving || !draft.Enabled} label={t("manage.fields.requireFill")} /></div></section>
        <div className="event-manage-content__layout"><div className="event-content-editor"><div className="event-content-editor__top"><div><h2>{t("manage.fields.editor.title")}</h2><p>{t("manage.fields.editor.subtitle")}</p></div><span>{blocks.length}</span></div>
            {blocks.length === 0 && <EmptyState message={t("manage.fields.editor.empty")} />}
            <div className="event-content-editor__stack">{blocks.map((block, index) => <FormBlockCard key={block.id} blocks={blocks} index={index} scope={scope} canEdit={canManage} disabled={!canManage || saving} open={!dragging && openIDs.includes(block.id)} selected={selectedID === block.id} error={problem?.index === index ? validation ?? undefined : undefined}
                onSelect={() => setSelected(current => ({...current, [draftKey]: block.id}))} onToggle={() => setBlockOpen(block.id, !openIDs.includes(block.id))} onDragStateChange={setDragging}
                onChange={setBlocks} onMove={direction => move(index, direction)} onDuplicate={() => duplicate(index)} onDelete={() => remove(index)} />)}</div>
            {canManage && <div className="event-content-editor__add" aria-label={t("manage.fields.editor.addBlock")}><button className="ib-btn" type="button" onClick={() => add(createFormField())}><Plus size={16} /> {t("manage.fields.editor.addField")}</button><button className="ib-btn" type="button" onClick={() => add({id: `section-${crypto.randomUUID()}`, type: "section", label: ""})}><Plus size={16} /> {t("manage.fields.block.section")}</button><button className="ib-btn" type="button" onClick={() => add({id: `text-${crypto.randomUUID()}`, type: "text", richText: emptyRichText()})}><Plus size={16} /> {t("manage.fields.block.text")}</button><button className="ib-btn" type="button" onClick={() => add({id: `divider-${crypto.randomUUID()}`, type: "divider"})}><Plus size={16} /> {t("manage.fields.block.divider")}</button></div>}
            {validation && (!invalidID || dragging || !openIDs.includes(invalidID)) && <p className="event-manage-validation" role="alert">{validation}</p>}
            {(dirty || saving) && <div className="event-content-editor__footer"><span>{t("manage.fields.unsavedChanges")}</span><div><button className="ib-btn" type="button" onClick={discard} disabled={saving}>{t("common.cancel")}</button><EventButton className="ib-btn ib-btn--primary" type="button" disabled={!canManage || saving || !!validation} onClick={() => void save()} busy={saving}>{t("manage.fields.save")}</EventButton></div></div>}
        </div><aside className="event-manage-content__preview" aria-label={t("manage.fields.preview.label")}><div className="event-manage-content__preview-head"><Eye size={17} /><div><h2>{t("manage.fields.preview.title")}</h2><p>{t("manage.fields.preview.subtitle")}</p></div></div><div className="event-manage-content__preview-window"><FormPreview blocks={blocks} selectedID={selectedID} scope={scope} /></div></aside></div>
    </div>;
}
