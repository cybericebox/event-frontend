"use client";

import {useState} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {ArrowDown, ArrowUp, Eye, Plus, Send, Trash2, X} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {toast} from "react-hot-toast";
import {createManageGenericForm, getManageGenericForms, sendManageGenericForm, updateManageGenericForm, type ManageGenericFormInput} from "@/api/manageFormResponses";
import type {FormBlock, FormField} from "@/api/manageParticipantForm";
import {EventLoading} from "@/components/event/EventLoading";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {useManager} from "@/components/event/manage/ManagerShell";
import {createFormField, isFormField, validateParticipantForm} from "@/components/event/manage/participantFormEditor";
import {EventSelect} from "@/components/ui/EventSelect";

const emptyForm: ManageGenericFormInput = {Title: "", Enabled: true, Required: false, Document: {blocks: []}};
const inputOptions: {value: FormField["input"]; label: string}[] = [
    {value: "text", label: "Коротка відповідь"}, {value: "long_text", label: "Розгорнута відповідь"},
    {value: "number", label: "Число"}, {value: "select", label: "Один варіант"},
    {value: "multi_select", label: "Кілька варіантів"}, {value: "checkbox", label: "Так або ні"},
];

function Preview({blocks, selectedID}: {blocks: FormBlock[]; selectedID: string}) {
    return <div className="event-form-preview">{blocks.map(block => <div className={`event-form-preview__block${block.id === selectedID ? " is-selected" : ""}`} key={block.id}>
        {block.type === "section" && <h3>{block.label || "Заголовок"}</h3>}
        {block.type === "text" && <div className="event-form-preview__text"><ReactMarkdown>{block.markdown || "Текст"}</ReactMarkdown></div>}
        {block.type === "divider" && <hr />}
        {isFormField(block) && <div className="event-manage-field"><strong>{block.label || "Нове питання"}{block.required && <span className="event-field-required">*</span>}</strong>{block.help && <small>{block.help}</small>}{block.input === "long_text" ? <textarea className="event-manage-input" rows={3} disabled placeholder="Відповідь учасника" /> : block.input === "checkbox" ? <label className="event-form-preview__choice"><input type="checkbox" disabled /> Так</label> : block.input === "select" || block.input === "multi_select" ? <div className="event-form-preview__choices">{(block.options ?? []).map((option, index) => <label className="event-form-preview__choice" key={index}><input type={block.input === "select" ? "radio" : "checkbox"} disabled />{option || `Варіант ${index + 1}`}</label>)}</div> : <input className="event-manage-input" type={block.input === "number" ? "number" : "text"} disabled placeholder="Відповідь учасника" />}</div>}
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
    return <div className="event-manage-form__condition"><label className="event-manage-form__switch"><input type="checkbox" checked={!!block.condition} disabled={disabled || preceding.length === 0} onChange={event => {const first = preceding[0]; onChange({...block, condition: event.target.checked && first ? {fieldKey: first.key, operator: "equals", value: conditionValue(first)} : undefined});}} />Показувати за умовою</label>{block.condition && <div className="event-manage-form__condition-fields"><EventSelect ariaLabel={`Попереднє питання для умови ${index + 1}`} value={block.condition.fieldKey} options={preceding.map(field => ({value: field.key, label: field.label || "Питання без назви"}))} disabled={disabled} onValueChange={value => {const next = preceding.find(field => field.key === value); if (next) onChange({...block, condition: {fieldKey: value, operator: "equals", value: conditionValue(next)}});}} /><EventSelect ariaLabel={`Порівняння для умови ${index + 1}`} value={block.condition.operator} options={[{value: "equals", label: "Дорівнює"}, {value: "not_equals", label: "Не дорівнює"}]} disabled={disabled} onValueChange={value => onChange({...block, condition: {...block.condition!, operator: value as "equals" | "not_equals"}})} />{source?.input === "checkbox" ? <EventSelect ariaLabel={`Значення умови ${index + 1}`} value={String(block.condition.value)} options={[{value: "true", label: "Так"}, {value: "false", label: "Ні"}]} disabled={disabled} onValueChange={value => onChange({...block, condition: {...block.condition!, value: value === "true"}})} /> : source?.input === "select" ? <EventSelect ariaLabel={`Значення умови ${index + 1}`} value={String(block.condition.value)} options={(source.options ?? []).filter(Boolean).map(value => ({value, label: value}))} disabled={disabled} onValueChange={value => onChange({...block, condition: {...block.condition!, value}})} /> : <input className="event-manage-input" aria-label={`Значення умови ${index + 1}`} type={source?.input === "number" ? "number" : "text"} value={String(block.condition.value)} onChange={event => onChange({...block, condition: {...block.condition!, value: source?.input === "number" ? Number(event.target.value) : event.target.value}})} disabled={disabled} placeholder="Значення" />}</div>}</div>;
}

export default function SurveysPage() {
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
    const validation = !draft.Title.trim() ? "Додайте назву форми." : !blocks.some(isFormField) ? "Додайте хоча б одне питання." : validateParticipantForm(draft.Document);
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
            toast.success(form ? "Опитування оновлено" : "Опитування створено");
        } catch {toast.error("Не вдалося зберегти опитування.");}
        finally {setSaving(false);}
    }
    async function send() {
        if (!form || !canManage || sending || dirty || !form.Enabled) return;
        setSending(true);
        try {await sendManageGenericForm(eventID, form.ID); toast.success("Опитування надіслано поточним учасникам");}
        catch {toast.error("Не вдалося надіслати опитування.");}
        finally {setSending(false);}
    }

    if (query.isPending) return <EventLoading event={event} label="Завантажуємо опитування…" />;
    if (query.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити опитування</h1><button className="ib-btn" type="button" onClick={() => void query.refetch()}>Повторити</button></div>;

    return <div className="event-manage-content event-manage-surveys">
        <header className="event-manage-heading"><div><h1>Опитування</h1><p>Створюйте форми для учасників. Кожне збереження питань створює нову версію.</p></div><span className="event-attempts-manager__total">{query.data.length} форм</span></header>
        <div className="event-manage-surveys__layout"><nav className="event-manage-section event-manage-surveys__list" aria-label="Опитування"><div className="event-manage-surveys__list-head"><strong>Форми</strong>{canManage && <button className="ib-btn ib-btn--sm" type="button" onClick={() => {setFormID("new"); setSelectedBlock(null);}}><Plus size={15} /> Створити</button>}</div>{query.data.map(item => <button type="button" className={`event-manage-surveys__item${formID === item.ID ? " is-selected" : ""}`} key={item.ID} onClick={() => {setFormID(item.ID); setSelectedBlock(null);}}><strong>{item.Title}</strong><small>Версія {item.Version} · {item.Enabled ? "увімкнено" : "вимкнено"}</small></button>)}{query.data.length === 0 && <p className="event-manage-surveys__list-empty">Опитувань ще немає.</p>}</nav>
            <div className="event-manage-surveys__main"><section className="event-manage-section event-manage-surveys__settings"><div className="event-manage-section__head"><h2>{form ? "Налаштування форми" : "Нове опитування"}</h2>{form && <span>Версія {form.Version}</span>}</div><label className="event-manage-field"><span>Назва<span className="event-field-required">*</span></span><input className="event-manage-input" value={draft.Title} onChange={e => change({...draft, Title: e.target.value})} disabled={!canManage || saving} placeholder="Наприклад, Відгук після події" /></label><div className="event-manage-fields-two"><div className="event-manage-field"><ManageFieldLabel title="Показувати форму" help="Вимкнена форма не видається новим адресатам. Збережені відповіді залишаються доступними." /><label className="event-manage-form__switch"><input type="checkbox" checked={draft.Enabled} onChange={e => change({...draft, Enabled: e.target.checked, Required: e.target.checked && draft.Required})} disabled={!canManage || saving} />Увімкнено</label></div><div className="event-manage-field"><ManageFieldLabel title="Обов’язкова форма" help="Якщо форму видано учаснику, заповнення можна вимагати перед окремими діями. Питання зі зірочкою обов’язкові для надсилання самої форми." /><label className="event-manage-form__switch"><input type="checkbox" checked={draft.Required} onChange={e => change({...draft, Required: e.target.checked})} disabled={!canManage || saving || !draft.Enabled} />Вимагати відповідь</label></div></div></section>
                <div className={`event-manage-content__layout${selectedID ? "" : " event-manage-content__layout--single"}`}><div className="event-content-editor"><div className="event-content-editor__top"><div><h2>Питання й текст</h2><p>Розташуйте блоки в порядку, в якому їх побачить учасник.</p></div><span>{blocks.length}</span></div>{blocks.length === 0 && <div className="event-content-editor__empty"><strong>Форма порожня</strong><span>Додайте питання для опитування.</span></div>}<div className="event-content-editor__stack">{blocks.map((block, index) => <section className={`event-content-editor__block${selectedID === block.id ? " is-selected" : ""}`} key={block.id} onClick={() => setSelectedBlock(block.id)} onFocusCapture={() => setSelectedBlock(block.id)}><div className="event-content-editor__block-head"><div className="event-content-editor__block-title"><span className="event-content-editor__order">{index + 1}</span><strong>{isFormField(block) ? "Питання" : block.type === "section" ? "Заголовок" : block.type === "text" ? "Текст" : "Роздільник"}</strong></div>{canManage && <div className="event-content-editor__block-actions"><button type="button" aria-label={`Перемістити блок ${index + 1} вище`} disabled={index === 0 || saving} onClick={() => move(index, -1)}><ArrowUp size={16} /></button><button type="button" aria-label={`Перемістити блок ${index + 1} нижче`} disabled={index === blocks.length - 1 || saving} onClick={() => move(index, 1)}><ArrowDown size={16} /></button><button className="event-content-editor__danger" type="button" aria-label={`Видалити блок ${index + 1}`} disabled={saving} onClick={() => remove(index)}><Trash2 size={16} /></button></div>}</div><div className="event-content-editor__block-body">{isFormField(block) ? <><label className="event-manage-field"><span>Питання<span className="event-field-required">*</span></span><input className="event-manage-input" value={block.label} onChange={e => updateBlock(index, {...block, label: e.target.value})} disabled={!canManage || saving} placeholder="Введіть питання" /></label><div className="event-manage-fields-two"><div className="event-manage-field"><span>Тип відповіді</span><EventSelect ariaLabel={`Тип відповіді питання ${index + 1}`} value={block.input} options={inputOptions} disabled={!canManage || saving} onValueChange={value => updateBlock(index, {...block, input: value as FormField["input"], options: value === "select" || value === "multi_select" ? block.options?.length ? block.options : [""] : undefined})} /></div><label className="event-manage-field"><span>Підказка</span><input className="event-manage-input" value={block.help ?? ""} onChange={e => updateBlock(index, {...block, help: e.target.value})} disabled={!canManage || saving} placeholder="Необов’язково" /></label></div>{(block.input === "select" || block.input === "multi_select") && <label className="event-manage-field"><span>Варіанти відповіді<span className="event-field-required">*</span></span><textarea className="event-manage-input" rows={Math.max(3, block.options?.length ?? 0)} value={(block.options ?? []).join("\n")} onChange={e => updateBlock(index, {...block, options: e.target.value.split("\n")})} disabled={!canManage || saving} placeholder="Один варіант на рядок" /></label>}<label className="event-manage-form__switch"><input type="checkbox" checked={!!block.required} onChange={e => updateBlock(index, {...block, required: e.target.checked})} disabled={!canManage || saving} />Відповідь обов’язкова</label><SurveyConditionEditor block={block} preceding={blocks.slice(0, index).filter(isFormField).filter(field => field.input !== "multi_select")} index={index} disabled={!canManage || saving} onChange={value => updateBlock(index, value)} /></> : block.type === "section" ? <label className="event-manage-field"><span>Заголовок<span className="event-field-required">*</span></span><input className="event-manage-input" value={block.label ?? ""} onChange={e => updateBlock(index, {...block, label: e.target.value})} disabled={!canManage || saving} /></label> : block.type === "text" ? <label className="event-manage-field"><span>Текст<span className="event-field-required">*</span></span><textarea className="event-manage-input" rows={4} value={block.markdown ?? ""} onChange={e => updateBlock(index, {...block, markdown: e.target.value})} disabled={!canManage || saving} /></label> : <p>Горизонтальний роздільник між питаннями.</p>}</div></section>)}</div>{canManage && <div className="event-content-editor__add" aria-label="Додати блок опитування"><button className="ib-btn" type="button" onClick={() => add(createFormField())}><Plus size={16} /> Питання</button><button className="ib-btn" type="button" onClick={() => add({id: `section-${crypto.randomUUID()}`, type: "section", label: ""})}><Plus size={16} /> Заголовок</button><button className="ib-btn" type="button" onClick={() => add({id: `text-${crypto.randomUUID()}`, type: "text", markdown: ""})}><Plus size={16} /> Текст</button><button className="ib-btn" type="button" onClick={() => add({id: `divider-${crypto.randomUUID()}`, type: "divider"})}><Plus size={16} /> Роздільник</button></div>}{validation && (dirty || formID === "new") && <p className="event-manage-validation" role="alert">{validation}</p>}{dirty && <div className="event-content-editor__footer"><span>Є незбережені зміни</span><div><button className="ib-btn" type="button" onClick={() => setDrafts(current => {const next = {...current}; delete next[formID]; return next;})} disabled={saving}>Скасувати</button><button className="ib-btn ib-btn--primary" type="button" disabled={!canManage || saving || !!validation} onClick={() => void save()}>{saving ? "Зберігаємо…" : form ? "Зберегти версію" : "Створити опитування"}</button></div></div>}</div>{selectedID && <aside className="event-manage-content__preview" aria-label="Попередній перегляд опитування"><div className="event-manage-content__preview-head"><Eye size={17} /><div><h2>Попередній перегляд</h2><p>Вся форма з виділеним блоком.</p></div><button className="event-manage-content__preview-close" type="button" aria-label="Закрити попередній перегляд" onClick={() => setSelectedBlock(null)}><X size={17} /></button></div><div className="event-manage-content__preview-window"><Preview blocks={blocks} selectedID={selectedID} /></div></aside>}</div>
                {form && <section className="event-manage-section event-manage-surveys__send"><div><h2>Надіслати поточним учасникам</h2><p>Учасники побачать форму в списку завдань. Після надсилання зможуть відповісти на збережену версію питань.</p></div><button className="ib-btn" type="button" disabled={!canManage || sending || dirty || !form.Enabled} onClick={() => void send()}><Send size={16} />{sending ? "Надсилаємо…" : "Надіслати зараз"}</button></section>}
            </div></div>
    </div>;
}
