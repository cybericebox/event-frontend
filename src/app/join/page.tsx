"use client";

import {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {EventRichTextView} from "@/components/event/content/EventRichTextView";
import {getCurrentUser, getInvitationStatus, getJoinStatus} from "@/api/clientAuth";
import {acceptSelfInvitation, getSelfParticipantForm, joinSelfEvent, submitSelfParticipantForm, type ParticipantAnswers} from "@/api/participantForm";
import {isFormField} from "@/components/event/manage/participantFormEditor";
import {ParticipationStatusEnum} from "@/types/event";
import {useGuestEvent} from "@/components/event/GuestShell";
import {useParticipantContext} from "@/components/event/ParticipantShell";

function visible(condition: {fieldKey: string; operator: string; value: string | number | boolean} | undefined, answers: ParticipantAnswers): boolean {
    if (!condition) return true;
    const answer = answers[condition.fieldKey];
    if (answer === undefined) return false;
    const equals = String(answer) === String(condition.value);
    return condition.operator === "equals" ? equals : !equals;
}

function present(value: ParticipantAnswers[string] | undefined): boolean {
    return value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0);
}

export default function JoinPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const guestEvent = useGuestEvent();
    const participant = useParticipantContext();
    const event = guestEvent ?? participant?.event;
    const identity = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, retry: false});
    const join = useQuery({queryKey: ["event-join-status", event?.EventID], queryFn: getJoinStatus, enabled: !!identity.data && !!event, retry: false});
    const invitation = useQuery({queryKey: ["event-invitation-status", event?.EventID], queryFn: getInvitationStatus, enabled: !!identity.data && !!event && join.data === 1, retry: false});
    const canJoin = join.data === 0 || (join.data === 1 && invitation.data === true);
    const form = useQuery({queryKey: ["event-participant-form", event?.EventID], queryFn: () => getSelfParticipantForm(event!.EventID), enabled: !!identity.data && !!event && canJoin, retry: false});
    const [answers, setAnswers] = useState<ParticipantAnswers>({});
    const [working, setWorking] = useState(false);
    const [error, setError] = useState("");

    async function submit() {
        if (!event || working || !identity.data || !canJoin || form.isPending || form.isError) return;
        setError("");
        const blocks = form.data?.Enabled ? form.data.Document.blocks : [];
        const sendForm = !!form.data?.Enabled && (form.data.Required || Object.values(answers).some(present));
        const sent: ParticipantAnswers = {};
        for (const block of sendForm ? blocks : []) {
            if (!isFormField(block) || !visible(block.condition, sent)) continue;
            const answer = answers[block.key];
            if (block.required && !present(answer)) {
                setError(`Заповніть обов’язкове питання «${block.label}».`);
                return;
            }
            if (present(answer)) sent[block.key] = answer!;
        }
        setWorking(true);
        try {
            if (sendForm) {
                await submitSelfParticipantForm(event.EventID, sent);
            }
            const status = invitation.data ? await acceptSelfInvitation() : await joinSelfEvent();
            queryClient.setQueryData(["event-join-status", event.EventID], status);
            void queryClient.invalidateQueries({queryKey: ["event-invitation-status", event.EventID]});
            if (status === ParticipationStatusEnum.ApprovedParticipationStatus) {
                void queryClient.invalidateQueries({queryKey: ["event-participant-info", event.EventID]});
                void queryClient.invalidateQueries({queryKey: ["event-own-team", event.EventID]});
            }
            router.push("/");
        } catch {
            setError("Не вдалося зберегти додаткові поля або приєднатися. Перевірте відповіді та спробуйте ще раз.");
        } finally {setWorking(false);}
    }

    const status = join.data;
    return <div className="event-join-page"><div className="event-join-card">
        <Link className="event-join-back" href="/">← На головну</Link>
        <h1>Приєднатися до події</h1>
        {!event || identity.isPending || (identity.data && (join.isPending || (status === 1 && invitation.isPending) || (canJoin && form.isPending))) ? <p>Завантажуємо умови участі…</p>
            : identity.isError || join.isError || invitation.isError || (canJoin && form.isError) ? <div role="alert"><p>Не вдалося завантажити умови участі.</p><button className="ib-btn" type="button" onClick={() => void (identity.isError ? identity.refetch() : join.isError ? join.refetch() : invitation.isError ? invitation.refetch() : form.refetch())}>Повторити</button></div>
            : !identity.data ? <p>Увійдіть до облікового запису, щоб приєднатися. Кнопка входу розташована вгорі сторінки.</p>
            : status === ParticipationStatusEnum.ApprovedParticipationStatus ? <p>Ви вже берете участь у події.</p>
            : status === ParticipationStatusEnum.PendingParticipationStatus && !invitation.data ? <p>Заявку на участь надіслано. Дочекайтеся рішення організаторів.</p>
            : status === ParticipationStatusEnum.RejectedParticipationStatus ? <p>Заявку відхилено. Зверніться до організаторів події.</p>
            : event.Registration === 0 && !invitation.data ? <p>Реєстрацію на подію закрито.</p>
            : <>
                {form.data?.Enabled && <div className="event-join-form"><h2>Додаткові поля учасника</h2><p>{form.data.Required ? "Заповніть поля перед приєднанням." : "Ці поля необов’язкові. Можете заповнити їх перед приєднанням."}</p>
                    {form.data.Document.blocks.map(block => {
                        if (isFormField(block)) {
                            if (!visible(block.condition, answers)) return null;
                            const key = block.key;
                            const update = (value: ParticipantAnswers[string]) => setAnswers(current => ({...current, [key]: value}));
                            return <div className="event-join-question" key={block.id}><label htmlFor={`join-${block.id}`}><strong>{block.label}</strong>{block.required && <span className="event-field-required" aria-label="Обов’язкове питання">*</span>}</label>{block.help && <p>{block.help}</p>}
                                {block.input === "long_text" ? <textarea id={`join-${block.id}`} className="event-join-input" rows={4} value={String(answers[key] ?? "")} onChange={e => update(e.target.value)} />
                                    : block.input === "number" ? <input id={`join-${block.id}`} className="event-join-input" type="number" value={typeof answers[key] === "number" ? answers[key] as number : ""} onChange={e => update(e.target.value === "" ? "" : Number(e.target.value))} />
                                    : block.input === "checkbox" ? <label className="event-join-choice"><input id={`join-${block.id}`} type="checkbox" checked={answers[key] === true} onChange={e => update(e.target.checked)} />Так</label>
                                    : block.input === "select" ? <select id={`join-${block.id}`} className="event-join-input" value={String(answers[key] ?? "")} onChange={e => update(e.target.value)}><option value="">Оберіть варіант</option>{(block.options ?? []).map(option => <option value={option} key={option}>{option}</option>)}</select>
                                    : block.input === "multi_select" ? <div className="event-join-options" id={`join-${block.id}`}>{(block.options ?? []).map(option => <label className="event-join-choice" key={option}><input type="checkbox" checked={Array.isArray(answers[key]) && (answers[key] as string[]).includes(option)} onChange={e => {const previous = Array.isArray(answers[key]) ? answers[key] as string[] : []; update(e.target.checked ? [...previous, option] : previous.filter(item => item !== option));}} />{option}</label>)}</div>
                                    : <input id={`join-${block.id}`} className="event-join-input" type="text" value={String(answers[key] ?? "")} onChange={e => update(e.target.value)} />}
                            </div>;
                        }
                        if (block.type === "section") return <h3 key={block.id}>{block.label}</h3>;
                        if (block.type === "text") return <div className="event-join-markdown" key={block.id}><EventRichTextView value={block.richText} /></div>;
                        if (block.type === "divider") return <hr key={block.id} />;
                        return null;
                    })}
                </div>}
                {error && <p className="event-join-error" role="alert">{error}</p>}
                <button className="ib-btn ib-btn--primary" type="button" disabled={working} onClick={() => void submit()}>{working ? "Надсилаємо…" : invitation.data ? "Прийняти запрошення" : "Приєднатися"}</button>
            </>}
    </div></div>;
}
