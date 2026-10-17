"use client";

import {useDraftDirty, useSessionDraftState} from "@/components/event/manage/manualDraft";

import {useMemo, useState, type FormEvent} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {CalendarDays, Info} from "lucide-react";
import {toast} from "react-hot-toast";
import {toastFailure} from "@/components/ui/toastApiError";
import {apiErrorMessage} from "@/api/apiErrors";
import {getManageConfig, getManageLifecycle, manageConfigInput, ManageApiError, putManageConfig, putManageLifecycle, type ManageLifecycle} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageDateField} from "@/components/event/manage/ManageDateField";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventLoading} from "@/components/event/EventLoading";
import {EventLoadError} from "@/components/event/EventLoadError";
import {t} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventDateTimePicker} from "@/components/ui/EventDateTimePicker";
import {StagesManager} from "@/components/event/manage/StagesManager";

type ScheduleDraft = {
    PublishAt: string;
    StartAt: string;
    FinishAt: string;
    WithdrawAt: string;
    ScheduledEnd: boolean;
};

type CountdownDraft = {ShowStart: boolean; ShowFinish: boolean; Minutes: number; Mode: "before_end" | "from_start"};

const validMinutes = (minutes: number) => Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440;

function localDateTime(iso: string | null): string {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
}

function toDraft(value: ManageLifecycle): ScheduleDraft {
    return {
        PublishAt: localDateTime(value.PublishAt),
        StartAt: localDateTime(value.StartAt),
        FinishAt: localDateTime(value.FinishAt),
        WithdrawAt: localDateTime(value.WithdrawAt),
        ScheduledEnd: !!value.FinishAt,
    };
}

function asTimestamp(value: string): number | null {
    if (!value) return null;
    const time = new Date(value).getTime();
    return Number.isNaN(time) ? null : time;
}

function lifecycleDateTime(value: string, saved: string | null): string | null {
    if (!value) return null;
    // The picker edits minutes; an unchanged field keeps the saved seconds.
    return value === localDateTime(saved) ? saved : new Date(value).toISOString();
}

export default function ManageSchedulePage() {
    const {event, canManage} = useManager();
    const queryClient = useQueryClient();
    const eventID = event.EventID;
    const lifecycle = useQuery({
        queryKey: ["event-management-lifecycle", eventID],
        queryFn: () => getManageLifecycle(eventID),
        refetchInterval: false, refetchOnWindowFocus: false,
    });
    const config = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchInterval: false, refetchOnWindowFocus: false});
    const [edited, setEdited] = useSessionDraftState<{eventID: string; value: ScheduleDraft} | null>("schedule", null);
    const [saving, setSaving] = useState(false);

    const [countdownEdited, setCountdownEdited] = useSessionDraftState<{eventID: string; value: CountdownDraft} | null>("countdown", null);
    const [countdownSaving, setCountdownSaving] = useState(false);

    const draft = edited?.eventID === eventID ? edited.value : lifecycle.data ? toDraft(lifecycle.data) : null;
    const setDraft = (value: ScheduleDraft) => setEdited({eventID, value});

    const fieldErrors = useMemo(() => {
        const errors: Partial<Record<keyof ScheduleDraft, string>> = {};
        if (!draft) return errors;
        const publish = asTimestamp(draft.PublishAt);
        const start = asTimestamp(draft.StartAt);
        const finish = asTimestamp(draft.FinishAt);
        const withdraw = asTimestamp(draft.WithdrawAt);
        if (publish === null) errors.PublishAt = t("manage.schedule.validation.publishAndStart");
        if (start === null) errors.StartAt = t("manage.schedule.validation.publishAndStart");
        else if (publish !== null && start < publish) errors.StartAt = t("manage.schedule.validation.startAfterPublish");
        if (draft.ScheduledEnd) {
            if (finish === null) errors.FinishAt = t("manage.schedule.validation.finishRequired");
            else if (start !== null && finish <= start) errors.FinishAt = t("manage.schedule.validation.finishAfterStart");
            if (draft.WithdrawAt && (withdraw === null || (finish !== null && withdraw <= finish))) errors.WithdrawAt = t("manage.schedule.validation.withdrawAfterFinish");
        }
        return errors;
    }, [draft]);
    const validation = Object.values(fieldErrors).some(Boolean);
    const showValidation = !!draft && !!(draft.PublishAt || draft.StartAt || draft.FinishAt || draft.WithdrawAt);
    const scheduleValue = (value: ScheduleDraft) => ({...value, FinishAt: value.ScheduledEnd ? value.FinishAt : "", WithdrawAt: value.ScheduledEnd ? value.WithdrawAt : ""});
    const dirty = !!draft && !!lifecycle.data && JSON.stringify(scheduleValue(draft)) !== JSON.stringify(scheduleValue(toDraft(lifecycle.data)));

    useDraftDirty("schedule", lifecycle.data ? dirty : undefined);
    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!draft || validation || !canManage || saving || (lifecycle.data?.Configured && !dirty) || config.data?.Participation === null) return;
        setSaving(true);
        try {
            const updated = await putManageLifecycle(eventID, {
                JoinPolicy: lifecycle.data!.JoinPolicy,
                PublishAt: lifecycleDateTime(draft.PublishAt, lifecycle.data!.PublishAt),
                StartAt: lifecycleDateTime(draft.StartAt, lifecycle.data!.StartAt),
                FinishAt: draft.ScheduledEnd ? lifecycleDateTime(draft.FinishAt, lifecycle.data!.FinishAt) : null,
                WithdrawAt: draft.ScheduledEnd ? lifecycleDateTime(draft.WithdrawAt, lifecycle.data!.WithdrawAt) : null,
            });
            queryClient.setQueryData(["event-management-lifecycle", eventID], updated);
            // Refresh stages after the event's schedule changes.
            void queryClient.invalidateQueries({queryKey: ["event-management-stages", eventID]});
            setEdited(current => current?.value === draft ? null : current);
            toast.success(t("manage.schedule.saved"));
        } catch (failure) {
            const status = failure instanceof ManageApiError ? failure.status : 0;
            const code = failure instanceof ManageApiError ? failure.code : undefined;
            toastFailure(failure, status === 409 ? apiErrorMessage(code, t("manage.schedule.error.conflict")) : status === 400 ? apiErrorMessage(code, t("manage.schedule.error.rejected")) : t("manage.schedule.error.saveFailed"));
        } finally { setSaving(false); }
    }

    const savedCountdown: CountdownDraft | null = config.data ? {ShowStart: config.data.ShowStartCountdown, ShowFinish: config.data.ShowFinishCountdown, Minutes: config.data.FinishCountdownMinutes, Mode: config.data.FinishCountdownMode} : null;
    const countdown = countdownEdited?.eventID === eventID ? countdownEdited.value : savedCountdown;
    const setCountdown = (value: CountdownDraft) => setCountdownEdited({eventID, value});
    const countdownDirty = !!countdown && JSON.stringify(countdown) !== JSON.stringify(savedCountdown);

    useDraftDirty("countdown", savedCountdown ? countdownDirty : undefined);

    async function saveCountdown(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!countdownDirty || !countdown || !config.data || !canManage || countdownSaving || !validMinutes(countdown.Minutes)) return;
        setCountdownSaving(true);
        try {
            const updated = await putManageConfig(eventID, {
                ...manageConfigInput(config.data),
                ShowStartCountdown: countdown.ShowStart, ShowFinishCountdown: countdown.ShowFinish, FinishCountdownMinutes: countdown.Minutes, FinishCountdownMode: countdown.Mode,
            });
            queryClient.setQueryData(["event-management-config", eventID], updated);
            setCountdownEdited(current => current?.value === countdown ? null : current);
            toast.success(t("manage.schedule.countdown.saved"));
        } catch (failure) {
            const status = failure instanceof ManageApiError ? failure.status : 0;
            toastFailure(failure, status === 409 ? t("manage.schedule.countdown.error.conflict") : status === 400 ? t("manage.schedule.countdown.error.rejected") : t("manage.schedule.countdown.error.saveFailed"));
        } finally { setCountdownSaving(false); }
    }

    if (lifecycle.isError || config.isError) return <EventLoadError message={t("manage.schedule.loadFailed")} error={lifecycle.error ?? config.error} onRetry={() => { void lifecycle.refetch(); void config.refetch(); }} />;
    if (lifecycle.isPending || config.isPending || !draft) return <EventLoading event={event} />;
    if (!lifecycle.data) return null;

    return <div className="event-manage-settings event-manage-schedule">
        <header className="event-manage-heading"><div><h1>{t("manage.schedule.title")}</h1><p>{t("manage.schedule.subtitle")}</p></div><span className="event-manage-status"><CalendarDays size={16} />{t(`manage.schedule.status.${lifecycle.data.Status}`)}</span></header>
        {!canManage && <div className="event-manage-notice" role="status"><Info size={18} />{t("manage.schedule.readOnly")}</div>}
        {!lifecycle.data.Configured && <div className="event-manage-notice" role="status"><Info size={18} />{t("manage.schedule.notConfigured")}</div>}
        {config.data?.Participation === null && <div className="event-manage-notice" role="status"><Info size={18} />{t("manage.schedule.chooseFormatBefore")}<Link href="/manage/participation-settings">{t("manage.schedule.chooseFormatLink")}</Link>{t("manage.schedule.chooseFormatAfter")}</div>}
        {!lifecycle.data.Infrastructure.CanStart && <div className="event-manage-feedback event-manage-feedback--error" role="status">{lifecycle.data.Infrastructure.Reason ? t("manage.schedule.infraNotReadyReason", {reason: lifecycle.data.Infrastructure.Reason}) : t("manage.schedule.infraNotReady")}</div>}
        <form className="event-manage-section" onSubmit={save}>
            <div className="event-manage-section__head"><h2>{t("manage.schedule.keyDates")}</h2><p>{t("manage.schedule.keyDatesHelp")}</p></div>
            <div className="event-manage-fields-two">
                <ManageDateField id="publish-at" error={showValidation ? fieldErrors.PublishAt : undefined} title={t("manage.schedule.publish")} help={lifecycle.data.Status === "not_published" ? t("manage.schedule.publishHelp") : t("manage.schedule.publishedHelp")} value={draft.PublishAt} onChange={value => setDraft({...draft, PublishAt: value})} disabled={!canManage || lifecycle.data.Status !== "not_published"} required />
                <ManageDateField id="start-at" error={showValidation ? fieldErrors.StartAt : undefined} title={t("manage.schedule.start")} help={t("manage.schedule.startHelp")} value={draft.StartAt} onChange={value => setDraft({...draft, StartAt: value})} disabled={!canManage} required />
            </div>
            <div className="event-manage-field"><ManageFieldLabel title={t("manage.schedule.scheduledEnd")} help={t("manage.schedule.scheduledEndHelp")} /><EventSwitch className="event-manage-form__switch" checked={draft.ScheduledEnd} onCheckedChange={checked => setDraft({...draft, ScheduledEnd: checked})} disabled={!canManage} label={t("manage.schedule.scheduleEnd")} /></div>
            {draft.ScheduledEnd && <div className="event-manage-fields-two">
                <ManageDateField id="finish-at" error={showValidation ? fieldErrors.FinishAt : undefined} title={t("manage.schedule.finish")} help={t("manage.schedule.finishHelp")} value={draft.FinishAt} onChange={value => setDraft({...draft, FinishAt: value})} disabled={!canManage || !draft.ScheduledEnd} required={draft.ScheduledEnd} />
                <div className="event-manage-field">
                    <ManageFieldLabel htmlFor="withdraw-at" title={t("manage.schedule.withdraw")} help={t("manage.schedule.withdrawHelp")} />
                    <EventDateTimePicker id="withdraw-at" aria-invalid={showValidation && !!fieldErrors.WithdrawAt || undefined} aria-describedby={showValidation && fieldErrors.WithdrawAt ? "withdraw-at-error" : undefined} ariaLabel={t("manage.schedule.withdraw")} value={draft.WithdrawAt} onChange={value => setDraft({...draft, WithdrawAt: value})} disabled={!canManage} allowClear />
                    {showValidation && fieldErrors.WithdrawAt && <p id="withdraw-at-error" className="event-manage-validation" role="alert">{fieldErrors.WithdrawAt}</p>}
                </div>
            </div>}
            <div className="event-manage-section__actions"><EventButton saveDirty={!lifecycle.data.Configured || dirty} className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || saving || config.data?.Participation === null || !!validation || (lifecycle.data.Configured && !dirty)} busy={saving}>{t("manage.schedule.save")}</EventButton></div>
        </form>
        <StagesManager eventID={eventID} lifecycle={lifecycle.data} canManage={canManage} />
        {countdown && <form className="event-manage-section" onSubmit={saveCountdown}>
            <div className="event-manage-section__head"><h2>{t("manage.schedule.countdown.title")}</h2><p>{t("manage.schedule.countdown.help")}</p></div>
            <div className="event-manage-field"><ManageFieldLabel title={t("manage.schedule.countdown.showStart")} help={t("manage.schedule.countdown.showStartHelp")} /><EventSwitch className="event-manage-form__switch" checked={countdown.ShowStart} onCheckedChange={checked => setCountdown({...countdown, ShowStart: checked})} disabled={!canManage} label={t("manage.schedule.countdown.startSwitch")} /></div>
            <div className="event-manage-field"><ManageFieldLabel title={t("manage.schedule.countdown.showFinish")} help={t("manage.schedule.countdown.showFinishHelp")} /><EventSwitch className="event-manage-form__switch" checked={countdown.ShowFinish} onCheckedChange={checked => setCountdown({...countdown, ShowFinish: checked})} disabled={!canManage} label={t("manage.schedule.countdown.finishSwitch")} /></div>
            {countdown.ShowFinish && <div className="event-manage-field">
                <ManageFieldLabel htmlFor="countdown-finish-minutes" title={t("manage.schedule.countdown.minutes")} help={t("manage.schedule.countdown.minutesHelp")} required />
                <input id="countdown-finish-minutes" className="event-manage-input event-results-settings__number" type="number" inputMode="numeric" min={1} max={1440} required value={countdown.Minutes} disabled={!canManage} aria-invalid={!validMinutes(countdown.Minutes)} aria-describedby={!validMinutes(countdown.Minutes) ? "countdown-finish-minutes-error" : undefined} onChange={event => setCountdown({...countdown, Minutes: Number(event.target.value)})} />
                {!validMinutes(countdown.Minutes) && <small id="countdown-finish-minutes-error" className="event-manage-validation" role="alert">{t("manage.schedule.countdown.minutesRange")}</small>}
            </div>}
            {countdown.ShowFinish && <div className="event-manage-field">
                <ManageFieldLabel title={t("manage.schedule.countdown.mode")} help={t("manage.schedule.countdown.modeHelp")} />
                <EventSelect ariaLabel={t("manage.schedule.countdown.mode")} value={countdown.Mode} disabled={!canManage}
                    options={[{value: "before_end", label: t("manage.schedule.countdown.mode.beforeEnd")}, {value: "from_start", label: t("manage.schedule.countdown.mode.fromStart")}]}
                    onValueChange={mode => setCountdown({...countdown, Mode: mode as CountdownDraft["Mode"]})} />
            </div>}
            <div className="event-manage-section__actions"><EventButton saveDirty={countdownDirty} className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || countdownSaving || !countdownDirty || !validMinutes(countdown.Minutes)} busy={countdownSaving}>{t("manage.schedule.countdown.save")}</EventButton></div>
        </form>}
    </div>;
}
