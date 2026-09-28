"use client";

import {useState, type FormEvent} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {getManageConfig, getManageLifecycle, ManageApiError, putManageConfig, putManageLifecycle, manageConfigInput} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventLoading} from "@/components/event/EventLoading";
import {EventSelect} from "@/components/ui/EventSelect";


export function RegistrationSettings() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const configQuery = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const lifecycleQuery = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchOnWindowFocus: false});
    const [edit, setEdit] = useState<{eventID: string; registration: 0 | 1 | 2; joinPolicy: 0 | 1; maxTeams: number | null; allowPseudonyms: boolean} | null>(null);
    const [saving, setSaving] = useState(false);
    const config = configQuery.data;
    const lifecycle = lifecycleQuery.data;
    const registration = edit?.eventID === eventID ? edit.registration : config?.Registration;
    const joinPolicy = edit?.eventID === eventID ? edit.joinPolicy : lifecycle?.JoinPolicy;
    const maxTeams = edit?.eventID === eventID ? edit.maxTeams : config?.MaxTeams;
    const allowPseudonyms = edit?.eventID === eventID ? edit.allowPseudonyms : config?.AllowPseudonyms;
    const registrationDirty = config !== undefined && (registration !== config.Registration || maxTeams !== config.MaxTeams || allowPseudonyms !== config.AllowPseudonyms);
    const joinDirty = lifecycle !== undefined && joinPolicy !== lifecycle.JoinPolicy;
    const dirty = registrationDirty || joinDirty;

    function update(patch: Partial<{registration: 0 | 1 | 2; joinPolicy: 0 | 1; maxTeams: number | null; allowPseudonyms: boolean}>) {
        if (registration === undefined || joinPolicy === undefined || maxTeams === undefined || allowPseudonyms === undefined) return;
        setEdit({eventID, registration: patch.registration ?? registration, joinPolicy: patch.joinPolicy ?? joinPolicy, maxTeams: patch.maxTeams === undefined ? maxTeams : patch.maxTeams, allowPseudonyms: patch.allowPseudonyms ?? allowPseudonyms});
    }

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!config || !lifecycle || registration === undefined || allowPseudonyms === undefined || joinPolicy === undefined || maxTeams === undefined || (maxTeams !== null && (!Number.isInteger(maxTeams) || maxTeams < 1)) || !canManage || saving || !dirty || (joinDirty && !lifecycle.Configured)) return;
        setSaving(true);
        try {
            if (registrationDirty) {
                const updated = await putManageConfig(eventID, {...manageConfigInput(config), Registration: registration, MaxTeams: maxTeams, AllowPseudonyms: allowPseudonyms});
                queryClient.setQueryData(["event-management-config", eventID], updated);
                queryClient.setQueryData<typeof event>(["event-manager-public-info"], current => current ? {...current, Registration: updated.Registration} : current);
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
    if (configQuery.isError || lifecycleQuery.isError || !config || !lifecycle) return <div className="event-manage-error" role="alert"><h2>Не вдалося завантажити налаштування реєстрації</h2><button className="ib-btn" onClick={() => {void configQuery.refetch(); void lifecycleQuery.refetch();}}>Повторити</button></div>;

    return <form className="event-manage-settings event-manage-general" onSubmit={save}>
        <section className="event-manage-section">
            <div className="event-manage-field"><ManageFieldLabel title="Тип реєстрації" help={"Визначає, як нові учасники приєднуються до події.\n\n• Закрита — нові заявки недоступні.\n• За схваленням — заявку перевіряє модератор.\n• Відкрита — учасники приєднуються самостійно.\n\nДо публікації реєстрація недоступна незалежно від цього вибору."} helpPlacement="bottom" required /><EventSelect ariaLabel="Тип реєстрації" value={String(registration)} options={[{value: "0", label: "Закрита"}, {value: "1", label: "За схваленням"}, {value: "2", label: "Відкрита"}]} onValueChange={value => update({registration: Number(value) as 0 | 1 | 2})} disabled={!canManage || saving} /></div>
            <div className="event-manage-field"><ManageFieldLabel title="Період приєднання" help={"Визначає, до якого часу можна приєднатися до події.\n\n• До початку — приєднання закриється на старті.\n• Протягом події — приєднання доступне й після старту."} helpPlacement="bottom" required />
                <div className="event-manage-choice-group" role="radiogroup" aria-label="Період приєднання">
                    <label><input type="radio" name="join-policy" checked={joinPolicy === 0} onChange={() => update({joinPolicy: 0})} disabled={!canManage || saving || !lifecycle.Configured} /><span><strong>До початку</strong><small>Приєднання закриється на старті.</small></span></label>
                    <label><input type="radio" name="join-policy" checked={joinPolicy === 1} onChange={() => update({joinPolicy: 1})} disabled={!canManage || saving || !lifecycle.Configured} /><span><strong>Протягом події</strong><small>Приєднатися можна й після старту.</small></span></label>
                </div>
                {!lifecycle.Configured && <small>Період можна змінити після збереження <Link href="/manage/schedule">публікації та часу</Link>.</small>}
            </div>
            {config.Participation === 1 && <div className="event-manage-field"><ManageFieldLabel htmlFor="max-teams" title="Кількість команд" help={"Найбільша кількість команд, які можуть приєднатися до події.\n\nЗалиште порожнім, якщо обмеження не потрібне."} /><input id="max-teams" className="event-manage-input" type="number" min={1} value={maxTeams ?? ""} onChange={change => update({maxTeams: change.target.value ? Number(change.target.value) : null})} disabled={!canManage || saving} placeholder="Без обмеження" /></div>}
            <div className="event-manage-field"><ManageFieldLabel title="Псевдоніми" help={"Учасник може задати псевдонім до старту події.\n\nПсевдонім бачать інші учасники в рейтингу. Організатори бачать і справжнє ім’я, і псевдонім."} /><label className="event-manage-form__switch"><input type="checkbox" checked={!!allowPseudonyms} onChange={change => update({allowPseudonyms: change.target.checked})} disabled={!canManage || saving} />Дозволити псевдоніми</label></div>
        </section>
        {(dirty || saving) && <div className="event-manage-savebar"><button className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || saving || (maxTeams !== null && maxTeams !== undefined && (!Number.isInteger(maxTeams) || maxTeams < 1))}>{saving ? "Зберігаємо…" : "Зберегти"}</button></div>}
    </form>;
}
