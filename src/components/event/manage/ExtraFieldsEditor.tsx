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
import {createFormField, isFormField, validateParticipantForm} from "@/components/event/manage/participantFormEditor";
import {EventSelect} from "@/components/ui/EventSelect";

const emptyForm: ParticipantFormInput = {Enabled: false, Required: false, Document: {blocks: []}};
const inputOptions: {value: FormField["input"]; label: string}[] = [
    {value: "text", label: "Коротка відповідь"},
    {value: "long_text", label: "Розгорнута відповідь"},
    {value: "number", label: "Число"},
    {value: "select", label: "Один варіант"},
    {value: "multi_select", label: "Кілька варіантів"},
    {value: "checkbox", label: "Так або ні"},
];

function initialConditionValue(source: FormField): string | number | boolean {
    if (source.input === "number") return 0;
    if (source.input === "checkbox") return true;
    if (source.input === "select") return source.options?.[0] ?? "";
    return "";
}

function FormPreview({blocks, selectedID, scope}: {blocks: FormBlock[]; selectedID: string | null; scope: "participant" | "team"}) {
    return <div className="event-form-preview">{blocks.map(block => <div className={`event-form-preview__block${block.id === selectedID ? " is-selected" : ""}`} key={block.id}>
        {block.type === "section" && <h3>{block.label || "Заголовок"}</h3>}
        {block.type === "text" && <div className="event-form-preview__text"><EventRichTextView value={block.richText} emptyFallback="Текст" /></div>}
        {block.type === "divider" && <hr />}
        {isFormField(block) && <div className="event-manage-field"><strong>{block.label || "Нове питання"}{block.required && <span className="event-field-required">*</span>}</strong>{block.condition && <small className="event-form-preview__condition">Умовне питання · показується залежно від відповіді на «{blocks.find(item => isFormField(item) && item.key === block.condition?.fieldKey)?.label || "попереднє питання"}».</small>}{block.help && <small>{block.help}</small>}
            {block.input === "long_text" ? <textarea className="event-manage-input" rows={3} disabled placeholder={scope === "team" ? "Відповідь команди" : "Відповідь учасника"} /> :
                block.input === "checkbox" ? <label className="event-form-preview__choice"><input type="checkbox" disabled /> Так</label> :
                block.input === "select" || block.input === "multi_select" ? <div className="event-form-preview__choices">{(block.options ?? []).map((option, index) => <label className="event-form-preview__choice" key={index}><input type={block.input === "select" ? "radio" : "checkbox"} disabled />{option || `Варіант ${index + 1}`}</label>)}</div> :
                <input className="event-manage-input" type={block.input === "number" ? "number" : "text"} disabled placeholder={scope === "team" ? "Відповідь команди" : "Відповідь учасника"} />}
        </div>}
        {!isFormField(block) && !["section", "text", "divider"].includes(block.type) && <span>Блок «{block.type}» збережеться без змін.</span>}
    </div>)}{blocks.length === 0 && <p>Додайте поле, щоб побачити попередній перегляд.</p>}</div>;
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
    function updateBlock(index: number, block: FormBlock) { change({...draft, Document: {blocks: blocks.map((item, position) => position === index ? block : item)}}); }
    function add(block: FormBlock) { change({...draft, Document: {blocks: [...blocks, block]}}); setSelected(current => ({...current, [draftKey]: block.id})); }
    function remove(index: number) {
        const removed = blocks[index];
        change({...draft, Document: {blocks: blocks.filter((_, position) => position !== index).map(block => isFormField(block) && isFormField(removed) && block.condition?.fieldKey === removed.key ? {...block, condition: undefined} : block)}});
    }
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
            toast.success(`Додаткові поля ${scope === "team" ? "команди" : "учасника"} збережено`);
        } catch {toast.error("Не вдалося зберегти додаткові поля. Перевірте їх і повторіть спробу.");}
        finally {setSaving(false);}
    }

    if (query.isPending) return <EventLoading event={event} label="Завантажуємо додаткові поля…" />;
    if (query.isError) return <div className="event-manage-error" role="alert"><h2>Не вдалося завантажити додаткові поля</h2><button className="ib-btn" type="button" onClick={() => void query.refetch()}>Повторити</button></div>;

    return <div className="event-manage-content event-manage-form">
        <div className="event-manage-form__head"><p>{scope === "team" ? "Відомості, які капітан заповнює під час створення команди." : "Відомості, які учасник заповнює під час реєстрації."}</p><span className="event-attempts-manager__total">{query.data ? `Версія ${query.data.Version}` : "Ще не збережено"}</span></div>
        <section className="event-manage-section event-manage-form__settings"><div className="event-manage-field"><ManageFieldLabel title="Додаткові поля" help={scope === "team" ? "Увімкнені поля з’являться під час створення команди." : "Увімкнені поля з’являться під час приєднання учасника до події."} /><label className="event-manage-form__switch"><input type="checkbox" checked={draft.Enabled} onChange={e => change({...draft, Enabled: e.target.checked, Required: e.target.checked && draft.Required})} disabled={!canManage || saving} />Показувати додаткові поля</label></div><div className="event-manage-field"><ManageFieldLabel title="Обов’язковість" help={scope === "team" ? "Якщо увімкнено, капітан має заповнити поля перед створенням команди. Зірочка позначає обов’язкову відповідь." : "Якщо увімкнено, учасник має заповнити ці поля перед приєднанням. Зірочка біля окремого поля позначає обов’язкову відповідь."} /><label className="event-manage-form__switch"><input type="checkbox" checked={draft.Required} onChange={e => change({...draft, Required: e.target.checked})} disabled={!canManage || saving || !draft.Enabled} />Вимагати заповнення полів</label></div></section>
        <div className="event-manage-content__layout"><div className="event-content-editor"><div className="event-content-editor__top"><div><h2>Питання й текст</h2><p>Розташуйте блоки в потрібному порядку. Умовне питання може залежати лише від попереднього.</p></div><span>{blocks.length}</span></div>
            {blocks.length === 0 && <div className="event-content-editor__empty"><strong>Додаткових полів немає</strong><span>Додайте поле або вступний текст.</span></div>}
            <div className="event-content-editor__stack">{blocks.map((block, index) => {
                const preceding = blocks.slice(0, index).filter(isFormField).filter(field => field.input !== "multi_select");
                const conditionSource = isFormField(block) ? preceding.find(field => field.key === block.condition?.fieldKey) : undefined;
                return <section className={`event-content-editor__block${selectedID === block.id ? " is-selected" : ""}`} key={block.id} onClick={() => setSelected(current => ({...current, [draftKey]: block.id}))} onFocusCapture={() => setSelected(current => ({...current, [draftKey]: block.id}))}>
                    <div className="event-content-editor__block-head"><div className="event-content-editor__block-title"><span className="event-content-editor__order">{index + 1}</span><strong>{isFormField(block) ? "Питання" : block.type === "section" ? "Заголовок" : block.type === "text" ? "Текст" : block.type === "divider" ? "Роздільник" : block.type}</strong></div>{canManage && <div className="event-content-editor__block-actions"><button type="button" aria-label={`Перемістити блок ${index + 1} вище`} disabled={index === 0 || saving} onClick={() => move(index, -1)}><ArrowUp size={16} /></button><button type="button" aria-label={`Перемістити блок ${index + 1} нижче`} disabled={index === blocks.length - 1 || saving} onClick={() => move(index, 1)}><ArrowDown size={16} /></button><button className="event-content-editor__danger" type="button" aria-label={`Видалити блок ${index + 1}`} disabled={saving} onClick={() => remove(index)}><Trash2 size={16} /></button></div>}</div>
                    <div className="event-content-editor__block-body">{isFormField(block) ? <>
                        <label className="event-manage-field"><span>Питання<span className="event-field-required">*</span></span><input className="event-manage-input" value={block.label} onChange={e => updateBlock(index, {...block, label: e.target.value})} disabled={!canManage || saving} placeholder="Введіть питання" /></label>
                        <div className="event-manage-fields-two"><div className="event-manage-field"><span>Тип відповіді</span><EventSelect ariaLabel={`Тип відповіді питання ${index + 1}`} value={block.input} options={inputOptions} disabled={!canManage || saving} onValueChange={value => updateBlock(index, {...block, input: value as FormField["input"], options: value === "select" || value === "multi_select" ? block.options?.length ? block.options : [""] : undefined})} /></div><label className="event-manage-field"><span>Підказка для {scope === "team" ? "команди" : "учасника"}</span><input className="event-manage-input" value={block.help ?? ""} onChange={e => updateBlock(index, {...block, help: e.target.value})} disabled={!canManage || saving} placeholder="Необов’язково" /></label></div>
                        {(block.input === "select" || block.input === "multi_select") && <label className="event-manage-field"><span>Варіанти відповідей<span className="event-field-required">*</span></span><textarea className="event-manage-input" rows={Math.max(3, block.options?.length ?? 0)} value={(block.options ?? []).join("\n")} onChange={e => updateBlock(index, {...block, options: e.target.value.split("\n")})} disabled={!canManage || saving} placeholder="Один варіант на рядок" /><small>Один варіант на рядок.</small></label>}
                        <label className="event-manage-form__switch"><input type="checkbox" checked={!!block.required} onChange={e => updateBlock(index, {...block, required: e.target.checked})} disabled={!canManage || saving} />Відповідь обов’язкова</label>
                        {scope === "team" && <label className="event-manage-form__switch"><input type="checkbox" checked={!!block.editable} onChange={e => updateBlock(index, {...block, editable: e.target.checked || undefined})} disabled={!canManage || saving} />Можна змінювати після створення</label>}
                        <div className="event-manage-form__condition"><label className="event-manage-form__switch"><input type="checkbox" checked={!!block.condition} disabled={!canManage || saving || preceding.length === 0} onChange={e => {const source = preceding[0]; updateBlock(index, {...block, condition: e.target.checked && source ? {fieldKey: source.key, operator: "equals", value: initialConditionValue(source)} : undefined});}} />Показувати за умовою</label>{block.condition && <div className="event-manage-form__condition-fields"><EventSelect ariaLabel={`Попереднє питання для умови ${index + 1}`} value={block.condition.fieldKey} options={preceding.map(field => ({value: field.key, label: field.label || "Питання без назви"}))} disabled={!canManage || saving} onValueChange={value => {const source = preceding.find(field => field.key === value); if (source) updateBlock(index, {...block, condition: {fieldKey: value, operator: "equals", value: initialConditionValue(source)}});}} /><EventSelect ariaLabel={`Порівняння для умови ${index + 1}`} value={block.condition.operator} options={[{value: "equals", label: "Дорівнює"}, {value: "not_equals", label: "Не дорівнює"}]} disabled={!canManage || saving} onValueChange={value => updateBlock(index, {...block, condition: {...block.condition!, operator: value as "equals" | "not_equals"}})} />{conditionSource?.input === "checkbox" ? <EventSelect ariaLabel={`Значення умови ${index + 1}`} value={String(block.condition.value)} options={[{value: "true", label: "Так"}, {value: "false", label: "Ні"}]} disabled={!canManage || saving} onValueChange={value => updateBlock(index, {...block, condition: {...block.condition!, value: value === "true"}})} /> : conditionSource?.input === "select" ? <EventSelect ariaLabel={`Значення умови ${index + 1}`} value={String(block.condition.value)} options={(conditionSource.options ?? []).filter(Boolean).map(value => ({value, label: value}))} disabled={!canManage || saving} onValueChange={value => updateBlock(index, {...block, condition: {...block.condition!, value}})} /> : <input className="event-manage-input" aria-label={`Значення умови ${index + 1}`} type={conditionSource?.input === "number" ? "number" : "text"} value={String(block.condition.value)} onChange={e => updateBlock(index, {...block, condition: {...block.condition!, value: conditionSource?.input === "number" ? Number(e.target.value) : e.target.value}})} disabled={!canManage || saving} placeholder="Значення" />}</div>}</div>
                    </> : block.type === "section" ? <label className="event-manage-field"><span>Заголовок<span className="event-field-required">*</span></span><input className="event-manage-input" value={block.label ?? ""} onChange={e => updateBlock(index, {...block, label: e.target.value})} disabled={!canManage || saving} /></label> : block.type === "text" ? <div className="event-manage-field"><span>Текст<span className="event-field-required">*</span></span><EventRichTextEditor value={block.richText ?? emptyRichText()} onChange={value => updateBlock(index, {...block, richText: value})} variables={[]} values={{}} disabled={!canManage || saving} ariaLabel="Текст" /></div> : block.type === "divider" ? <p>Горизонтальний роздільник між питаннями.</p> : <p>Цей блок можна переглянути, але налаштування для нього тут недоступні.</p>}</div>
                </section>;
            })}</div>
            {canManage && <div className="event-content-editor__add" aria-label="Додати блок додаткових полів"><button className="ib-btn" type="button" onClick={() => add(createFormField())}><Plus size={16} /> Поле</button><button className="ib-btn" type="button" onClick={() => add({id: `section-${crypto.randomUUID()}`, type: "section", label: ""})}><Plus size={16} /> Заголовок</button><button className="ib-btn" type="button" onClick={() => add({id: `text-${crypto.randomUUID()}`, type: "text", richText: emptyRichText()})}><Plus size={16} /> Текст</button><button className="ib-btn" type="button" onClick={() => add({id: `divider-${crypto.randomUUID()}`, type: "divider"})}><Plus size={16} /> Роздільник</button></div>}
            {validation && <p className="event-manage-validation" role="alert">{validation}</p>}
            {(dirty || saving) && <div className="event-content-editor__footer"><span>Є незбережені зміни</span><div><button className="ib-btn" type="button" onClick={discard} disabled={saving}>Скасувати</button><button className="ib-btn ib-btn--primary" type="button" disabled={!canManage || saving || !!validation} onClick={() => void save()}>{saving ? "Зберігаємо…" : "Зберегти додаткові поля"}</button></div></div>}
        </div><aside className="event-manage-content__preview" aria-label="Попередній перегляд додаткових полів"><div className="event-manage-content__preview-head"><Eye size={17} /><div><h2>Попередній перегляд</h2><p>Усі поля в поточному порядку.</p></div></div><div className="event-manage-content__preview-window"><FormPreview blocks={blocks} selectedID={selectedID} scope={scope} /></div></aside></div>
    </div>;
}
