"use client";

import {notFound} from "next/navigation";
import {EmptyState} from "@/components/ui/EmptyState";
import {EVENT_FORMS_ENABLED} from "@/utils/features";
import {useState} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {EventRichTextView} from "@/components/event/content/EventRichTextView";
import {toast} from "react-hot-toast";
import {getOwnEventForm, getPendingEventForms, submitEventForm, type EventFormAnswers} from "@/api/participantEventForms";
import {useParticipantContext} from "@/components/event/ParticipantShell";
import {isFormField} from "@/components/event/manage/participantFormEditor";
import {t} from "@/i18n/t";
import {EventLoading} from "@/components/event/EventLoading";

function visible(condition: {fieldKey: string; operator: string; value: string | number | boolean} | undefined, answers: EventFormAnswers): boolean {
    if (!condition) return true;
    const answer = answers[condition.fieldKey];
    if (answer === undefined) return false;
    const equals = String(answer) === String(condition.value);
    return condition.operator === "equals" ? equals : !equals;
}

function present(value: EventFormAnswers[string] | undefined): boolean {
    return value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
}

function FormsPage() {
    const context = useParticipantContext();
    const eventID = context?.event.EventID ?? "";
    const queryClient = useQueryClient();
    const pending = useQuery({queryKey: ["event-pending-forms", eventID], queryFn: () => getPendingEventForms(eventID), enabled: !!eventID, retry: false});
    const [selectedID, setSelectedID] = useState<string | null>(null);
    const [drafts, setDrafts] = useState<Record<string, EventFormAnswers>>({});
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");
    const selected = pending.data?.find(item => item.Form.ID === selectedID);
    const form = useQuery({queryKey: ["event-own-form", eventID, selectedID], queryFn: () => getOwnEventForm(eventID, selectedID!), enabled: !!eventID && !!selected, retry: false});
    const answers = selectedID ? drafts[selectedID] ?? {} : {};
    function update(key: string, value: EventFormAnswers[string]) {if (selectedID) setDrafts(current => ({...current, [selectedID]: {...current[selectedID], [key]: value}}));}

    async function submit() {
        if (!selected || !form.data || working) return;
        const values: EventFormAnswers = {};
        for (const block of form.data.Document.blocks) {
            if (!isFormField(block) || !visible(block.condition, values)) continue;
            const value = answers[block.key];
            if (block.required && !present(value)) {setError(t("forms.field.requiredMissing", {label: block.label})); return;}
            if (present(value)) values[block.key] = value!;
        }
        setWorking(true); setError("");
        try {
            await submitEventForm(eventID, selected.Form.ID, selected.FormVersionID, values);
            await queryClient.invalidateQueries({queryKey: ["event-pending-forms", eventID]});
            setSelectedID(null);
            toast.success(t("forms.submitted"));
        } catch {setError(t("forms.submitFailed"));}
        finally {setWorking(false);}
    }

    if (!context) return <div className="event-forms-page"><h1>{t("forms.title")}</h1><p>{t("forms.participantsOnly")}</p><Link className="ib-btn" href="/join">{t("forms.toJoin")}</Link></div>;
    return <div className="event-forms-page"><header><Link className="event-join-back" href="/">{t("common.backHomeArrow")}</Link><h1>{t("forms.pageTitle")}</h1><p>{t("forms.pageHint")}</p></header>
        {pending.isPending ? <EventLoading event={context.event} label={t("forms.loading")} /> : pending.isError ? <div className="event-forms-page__state" role="alert"><p>{t("forms.loadFailed")}</p><button className="ib-btn" type="button" onClick={() => void pending.refetch()}>{t("common.retry")}</button></div> : pending.data.length === 0 ? <EmptyState message={t("forms.emptyMessage")} /> : <div className="event-forms-page__layout"><section className="event-forms-page__list" aria-label={t("forms.pageTitle")}>{pending.data.map(item => <button className={`event-forms-page__item${selectedID === item.Form.ID ? " is-selected" : ""}`} type="button" key={item.Form.ID} onClick={() => {setSelectedID(item.Form.ID); setError("");}}><strong>{item.Form.Title}</strong><span>{item.Form.Required ? t("forms.required") : t("forms.optional")}</span></button>)}</section>
            <section className="event-forms-page__detail" aria-label={t("forms.answer")}>{!selected ? <div className="event-forms-page__state"><h2>{t("forms.choose.title")}</h2><p>{t("forms.choose.body")}</p></div> : form.isPending ? <EventLoading event={context.event} label={t("forms.questions.loading")} /> : form.isError ? <div role="alert"><p>{t("forms.questions.failed")}</p><button className="ib-btn" type="button" onClick={() => void form.refetch()}>{t("common.retry")}</button></div> : <><div className="event-forms-page__detail-head"><h2>{form.data.Title}</h2><span>{t("forms.version", {version: form.data.Version})}</span></div><div className="event-join-form">{form.data.Document.blocks.map(block => {
                if (isFormField(block)) {
                    if (!visible(block.condition, answers)) return null;
                    const key = block.key;
                    const fieldID = `form-${selected.Form.ID}-${block.id}`;
                    return <div className="event-join-question" key={block.id}><label htmlFor={fieldID}><strong>{block.label}</strong>{block.required && <span className="event-field-required" aria-label={t("forms.field.required")}>*</span>}</label>{block.help && <p>{block.help}</p>}
                        {block.input === "long_text" ? <textarea id={fieldID} className="event-join-input" rows={4} value={String(answers[key] ?? "")} onChange={e => update(key, e.target.value)} />
                            : block.input === "number" ? <input id={fieldID} className="event-join-input" type="number" value={typeof answers[key] === "number" ? answers[key] as number : ""} onChange={e => update(key, e.target.value === "" ? "" : Number(e.target.value))} />
                            : block.input === "checkbox" ? <label className="event-join-choice"><input id={fieldID} type="checkbox" checked={answers[key] === true} onChange={e => update(key, e.target.checked)} />{t("common.yes")}</label>
                            : block.input === "select" ? <select id={fieldID} className="event-join-input" value={String(answers[key] ?? "")} onChange={e => update(key, e.target.value)}><option value="">{t("common.chooseOption")}</option>{(block.options ?? []).map(option => <option value={option} key={option}>{option}</option>)}</select>
                            : block.input === "multi_select" ? <div className="event-join-options" id={fieldID}>{(block.options ?? []).map(option => <label className="event-join-choice" key={option}><input type="checkbox" checked={Array.isArray(answers[key]) && (answers[key] as string[]).includes(option)} onChange={e => {const previous = Array.isArray(answers[key]) ? answers[key] as string[] : []; update(key, e.target.checked ? [...previous, option] : previous.filter(item => item !== option));}} />{option}</label>)}</div>
                            : <input id={fieldID} className="event-join-input" type="text" value={String(answers[key] ?? "")} onChange={e => update(key, e.target.value)} />}</div>;
                }
                if (block.type === "section") return <h3 key={block.id}>{block.label}</h3>;
                if (block.type === "text") return <div className="event-join-markdown" key={block.id}><EventRichTextView value={block.richText} /></div>;
                if (block.type === "divider") return <hr key={block.id} />;
                return null;
            })}</div>{error && <p className="event-join-error" role="alert">{error}</p>}<button className="ib-btn ib-btn--primary" type="button" disabled={working} onClick={() => void submit()}>{working ? t("common.sending") : t("forms.send")}</button></>}</section></div>}
    </div>;
}

export default function Page() {
    if (!EVENT_FORMS_ENABLED) notFound();
    return <FormsPage />;
}
