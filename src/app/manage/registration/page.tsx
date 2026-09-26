"use client";

import {useState, type FormEvent} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {getManageConfig, getManageLifecycle, ManageApiError, putManageConfig, putManageLifecycle, type ManageConfig, type ManageConfigInput} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventLoading} from "@/components/event/EventLoading";
import {EventSelect} from "@/components/ui/EventSelect";

function asInput(config: ManageConfig): ManageConfigInput {
    return {Participation: config.Participation, Registration: config.Registration, ScoreboardVisibility: config.ScoreboardVisibility, ParticipantsVisibility: config.ParticipantsVisibility, PreviewDescription: config.PreviewDescription, PreviewPicture: config.PreviewPicture, MaxTeamSize: config.MaxTeamSize, MinTeamSize: config.MinTeamSize, MaxTeams: config.MaxTeams, DynamicLabsPlanned: config.DynamicLabsPlanned};
}

export default function RegistrationPage() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const configQuery = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const lifecycleQuery = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchOnWindowFocus: false});
    const [edit, setEdit] = useState<{eventID: string; registration: 0 | 1 | 2; joinPolicy: 0 | 1} | null>(null);
    const [saving, setSaving] = useState(false);
    const config = configQuery.data;
    const lifecycle = lifecycleQuery.data;
    const registration = edit?.eventID === eventID ? edit.registration : config?.Registration;
    const joinPolicy = edit?.eventID === eventID ? edit.joinPolicy : lifecycle?.JoinPolicy;
    const registrationDirty = config !== undefined && registration !== config.Registration;
    const joinDirty = lifecycle !== undefined && joinPolicy !== lifecycle.JoinPolicy;
    const dirty = registrationDirty || joinDirty;

    function update(patch: Partial<{registration: 0 | 1 | 2; joinPolicy: 0 | 1}>) {
        if (registration === undefined || joinPolicy === undefined) return;
        setEdit({eventID, registration: patch.registration ?? registration, joinPolicy: patch.joinPolicy ?? joinPolicy});
    }

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!config || !lifecycle || registration === undefined || joinPolicy === undefined || !canManage || saving || !dirty || (joinDirty && !lifecycle.Configured)) return;
        setSaving(true);
        try {
            if (registrationDirty) {
                const updated = await putManageConfig(eventID, {...asInput(config), Registration: registration});
                queryClient.setQueryData(["event-management-config", eventID], updated);
            }
            if (joinDirty) {
                const updated = await putManageLifecycle(eventID, {
                    JoinPolicy: joinPolicy, PublishAt: lifecycle.PublishAt, StartAt: lifecycle.StartAt,
                    FinishAt: lifecycle.FinishAt, WithdrawAt: lifecycle.WithdrawAt,
                });
                queryClient.setQueryData(["event-management-lifecycle", eventID], updated);
            }
            setEdit(null);
            toast.success("Налаштування реєстрації збережено");
        } catch (failure) {
            const status = failure instanceof ManageApiError ? failure.status : 0;
            toast.error(status === 409 ? "Налаштування змінилися в іншому місці. Оновіть сторінку." : "Не вдалося зберегти налаштування реєстрації.");
        } finally {setSaving(false);}
    }

    if (configQuery.isPending || lifecycleQuery.isPending) return <EventLoading event={event} />;
    if (configQuery.isError || lifecycleQuery.isError || !config || !lifecycle) return <div className="event-manage-error" role="alert"><h1>Не вдалося завантажити налаштування реєстрації</h1><button className="ib-btn" onClick={() => {void configQuery.refetch(); void lifecycleQuery.refetch();}}>Повторити</button></div>;

    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <header className="event-manage-heading"><div><h1>Реєстрація</h1><p>Визначте спосіб і період приєднання до події.</p></div></header>
        <section className="event-manage-section">
            <div className="event-manage-field"><ManageFieldLabel title="Тип реєстрації" help={"Визначає, як нові учасники приєднуються до події.\n\n• Закрита — нові заявки недоступні.\n• За схваленням — заявку перевіряє модератор.\n• Відкрита — учасники приєднуються самостійно.\n\nДо публікації реєстрація недоступна незалежно від цього вибору."} helpPlacement="bottom" required /><EventSelect ariaLabel="Тип реєстрації" value={String(registration)} options={[{value: "0", label: "Закрита"}, {value: "1", label: "За схваленням"}, {value: "2", label: "Відкрита"}]} onValueChange={value => update({registration: Number(value) as 0 | 1 | 2})} disabled={!canManage || saving} /></div>
            <div className="event-manage-field"><ManageFieldLabel title="Період приєднання" help={"Визначає, до якого часу можна приєднатися до події або змінити команду.\n\n• До початку — приєднання закриється на старті.\n• Протягом події — приєднання доступне й після старту."} helpPlacement="bottom" required />
                <div className="event-manage-choice-group" role="radiogroup" aria-label="Період приєднання">
                    <label><input type="radio" name="join-policy" checked={joinPolicy === 0} onChange={() => update({joinPolicy: 0})} disabled={!canManage || saving || !lifecycle.Configured} /><span><strong>До початку</strong><small>Приєднання закриється на старті.</small></span></label>
                    <label><input type="radio" name="join-policy" checked={joinPolicy === 1} onChange={() => update({joinPolicy: 1})} disabled={!canManage || saving || !lifecycle.Configured} /><span><strong>Протягом події</strong><small>Приєднатися можна й після старту.</small></span></label>
                </div>
                {!lifecycle.Configured && <small>Період можна змінити після збереження <Link href="/manage/schedule">публікації та часу</Link>.</small>}
            </div>
        </section>
        {(dirty || saving) && <div className="event-manage-savebar"><button className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || saving}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div>}
    </form>;
}
