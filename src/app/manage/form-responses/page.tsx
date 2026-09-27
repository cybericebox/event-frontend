"use client";

import {useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {FileText, X} from "lucide-react";
import {getManageGenericFormAnswers, getManageGenericForms, getManageParticipantFormAnswers, type ManageGenericFormAnswer, type ManageParticipantFormAnswer} from "@/api/manageFormResponses";
import {EventLoading} from "@/components/event/EventLoading";
import {useManager} from "@/components/event/manage/ManagerShell";
import {isFormField} from "@/components/event/manage/participantFormEditor";
import {EventSelect} from "@/components/ui/EventSelect";

type Answer = ManageParticipantFormAnswer | ManageGenericFormAnswer;
const dateTime = new Intl.DateTimeFormat("uk-UA", {dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Kyiv"});
const pageSize = 20;

function answerValue(value: unknown): string {
    if (value === undefined || value === null || value === "") return "—";
    if (value === true) return "Так";
    if (value === false) return "Ні";
    if (Array.isArray(value)) return value.map(answerValue).join(" · ") || "—";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function responseKey(answer: Answer, index: number): string {
    return `${answer.UserID}-${answer.SubmittedAt}-${index}`;
}

export default function FormResponsesPage() {
    const {event} = useManager();
    const eventID = event.EventID;
    const [formID, setFormID] = useState("participant");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const forms = useQuery({queryKey: ["event-management-generic-forms", eventID], queryFn: () => getManageGenericForms(eventID), refetchOnWindowFocus: false});
    const responses = useQuery<Answer[]>({
        queryKey: ["event-management-form-responses", eventID, formID],
        queryFn: () => formID === "participant" ? getManageParticipantFormAnswers(eventID) : getManageGenericFormAnswers(eventID, formID),
        refetchOnWindowFocus: false,
    });

    if (forms.isPending || responses.isPending) return <EventLoading event={event} label="Завантажуємо відповіді…" />;
    if (forms.isError || responses.isError) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити відповіді</h1><button className="ib-btn" type="button" onClick={() => void (forms.isError ? forms.refetch() : responses.refetch())}>Повторити</button></div>;

    const title = formID === "participant" ? "Анкета учасника" : forms.data.find(form => form.ID === formID)?.Title ?? "Форма";
    const term = search.trim().toLocaleLowerCase("uk-UA");
    const filtered = responses.data.filter(answer => !term || [answer.Name, answer.Email, answer.UserID, ...Object.values(answer.Answers).map(answerValue)].some(value => value.toLocaleLowerCase("uk-UA").includes(term)));
    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(page, pageCount - 1);
    const shown = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
    const active = shown.find((answer, index) => responseKey(answer, index) === selected);
    const fields = active?.Document.blocks.filter(isFormField) ?? [];
    const knownKeys = new Set(fields.map(field => field.key));

    return <div className="event-manage-content event-form-responses">
        <header className="event-manage-heading"><div><h1>Відповіді на форми</h1><p>Відповіді показано з питаннями тієї версії, яку заповнював учасник.</p></div><span className="event-attempts-manager__total">{responses.data.length} відповідей</span></header>
        <div className="event-form-responses__filters"><div className="event-manage-field"><label htmlFor="responses-form">Форма</label><EventSelect ariaLabel="Форма для перегляду відповідей" value={formID} options={[{value: "participant", label: "Анкета учасника"}, ...forms.data.map(form => ({value: form.ID, label: form.Title}))]} onValueChange={value => {setFormID(value); setSearch(""); setPage(0); setSelected(null);}} /></div><label className="event-manage-field"><span>Пошук у відповідях</span><input className="event-manage-input" type="search" value={search} onChange={e => {setSearch(e.target.value); setPage(0); setSelected(null);}} placeholder="Ім’я, пошта або відповідь" /></label></div>
        <div className={`event-form-responses__layout${active ? " is-open" : ""}`}><section className="event-manage-section event-form-responses__list" aria-label={`Відповіді: ${title}`}>
            <div className="event-form-responses__list-head"><strong>{title}</strong><span>{filtered.length}</span></div>
            {shown.length === 0 ? <div className="event-form-responses__empty"><FileText size={25} /><strong>{term ? "Нічого не знайдено" : "Відповідей поки немає"}</strong><span>{term ? "Змініть пошуковий запит." : "Коли учасники надішлють форму, відповіді з’являться тут."}</span></div> : shown.map((answer, index) => {const key = responseKey(answer, index); return <button className={`event-form-responses__row${active && key === selected ? " is-selected" : ""}`} type="button" key={key} onClick={() => setSelected(key)} aria-pressed={key === selected}><span><strong>{answer.Name || answer.Email || `Учасник ${answer.UserID.slice(0, 8)}`}</strong>{answer.Email && <small>{answer.Email}</small>}</span><span><small>Версія {"FormVersion" in answer ? answer.FormVersion : answer.Version}</small><time dateTime={answer.SubmittedAt}>{dateTime.format(new Date(answer.SubmittedAt))}</time></span></button>;})}
            {pageCount > 1 && <div className="event-attempts-manager__pagination"><button className="ib-btn ib-btn--sm" type="button" disabled={currentPage === 0} onClick={() => {setPage(value => value - 1); setSelected(null);}}>Назад</button><span>Сторінка {currentPage + 1} із {pageCount}</span><button className="ib-btn ib-btn--sm" type="button" disabled={currentPage + 1 === pageCount} onClick={() => {setPage(value => value + 1); setSelected(null);}}>Далі</button></div>}
        </section>{active && <aside className="event-manage-section event-form-responses__details" aria-label="Відповідь учасника"><div className="event-form-responses__details-head"><div><h2>{active.Name || active.Email || `Учасник ${active.UserID.slice(0, 8)}`}</h2><p>{active.Email}</p></div><button type="button" className="event-manage-content__preview-close" aria-label="Закрити відповідь" onClick={() => setSelected(null)}><X size={18} /></button></div><p className="event-form-responses__meta">Версія {"FormVersion" in active ? active.FormVersion : active.Version} · {dateTime.format(new Date(active.SubmittedAt))} (Київ)</p><dl className="event-form-responses__answers">{fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{answerValue(active.Answers[field.key])}</dd></div>)}{Object.entries(active.Answers).filter(([key]) => !knownKeys.has(key)).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{answerValue(value)}</dd></div>)}{fields.length === 0 && Object.keys(active.Answers).length === 0 && <div><dd>У цій версії не було питань для відповіді.</dd></div>}</dl></aside>}</div>
    </div>;
}
