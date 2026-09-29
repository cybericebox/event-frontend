"use client";

import {useMemo, useState, type FormEvent} from "react";
import Link from "next/link";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {CalendarDays, Info} from "lucide-react";
import {toast} from "react-hot-toast";
import {getManageConfig, getManageLifecycle, ManageApiError, putManageLifecycle, type ManageLifecycle} from "@/api/manage";
import {useManager} from "@/components/event/manage/ManagerShell";
import {ManageDateField} from "@/components/event/manage/ManageDateField";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {EventLoading} from "@/components/event/EventLoading";
import {t} from "@/i18n/t";
import {EventButton} from "@/components/ui/EventButton";
import {EventSwitch} from "@/components/ui/EventSwitch";

type ScheduleDraft = {
    PublishAt: string;
    StartAt: string;
    FinishAt: string;
    WithdrawAt: string;
    ScheduledEnd: boolean;
};

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
    const [edited, setEdited] = useState<{eventID: string; value: ScheduleDraft} | null>(null);
    const [saving, setSaving] = useState(false);

    const draft = edited?.eventID === eventID ? edited.value : lifecycle.data ? toDraft(lifecycle.data) : null;
    const setDraft = (value: ScheduleDraft) => setEdited({eventID, value});

    const validation = useMemo(() => {
        if (!draft) return "";
        const publish = asTimestamp(draft.PublishAt);
        const start = asTimestamp(draft.StartAt);
        const finish = asTimestamp(draft.FinishAt);
        const withdraw = asTimestamp(draft.WithdrawAt);
        if (publish === null || start === null) return t("manage.schedule.validation.publishAndStart");
        if (start < publish) return t("manage.schedule.validation.startAfterPublish");
        if (draft.ScheduledEnd) {
            if (finish === null || withdraw === null) return t("manage.schedule.validation.bothEndTimes");
            if (finish <= start) return t("manage.schedule.validation.finishAfterStart");
            if (withdraw <= finish) return t("manage.schedule.validation.withdrawAfterFinish");
        }
        return "";
    }, [draft]);
    const dirty = !!draft && !!lifecycle.data && JSON.stringify(draft) !== JSON.stringify(toDraft(lifecycle.data));

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!draft || validation || !canManage || saving || config.data?.Participation === null) return;
        setSaving(true);
        try {
            const updated = await putManageLifecycle(eventID, {
                JoinPolicy: lifecycle.data!.JoinPolicy,
                PublishAt: new Date(draft.PublishAt).toISOString(),
                StartAt: new Date(draft.StartAt).toISOString(),
                FinishAt: draft.ScheduledEnd ? new Date(draft.FinishAt).toISOString() : null,
                WithdrawAt: draft.ScheduledEnd ? new Date(draft.WithdrawAt).toISOString() : null,
            });
            queryClient.setQueryData(["event-management-lifecycle", eventID], updated);
            setEdited(null);
            toast.success(t("manage.schedule.saved"));
        } catch (failure) {
            const status = failure instanceof ManageApiError ? failure.status : 0;
            toast.error(status === 409 ? t("manage.schedule.error.conflict") : status === 400 ? t("manage.schedule.error.rejected") : t("manage.schedule.error.saveFailed"));
        } finally { setSaving(false); }
    }

    if (lifecycle.isError || config.isError) return <div className="event-manage-error" role="alert"><h1>{t("manage.schedule.loadFailed")}</h1><button className="ib-btn" onClick={() => { void lifecycle.refetch(); void config.refetch(); }}>{t("common.retry")}</button></div>;
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
                <ManageDateField id="publish-at" title={t("manage.schedule.publish")} help={lifecycle.data.Status === "not_published" ? t("manage.schedule.publishHelp") : t("manage.schedule.publishedHelp")} value={draft.PublishAt} onChange={value => setDraft({...draft, PublishAt: value})} disabled={!canManage || saving || lifecycle.data.Status !== "not_published"} required />
                <ManageDateField id="start-at" title={t("manage.schedule.start")} help={t("manage.schedule.startHelp")} value={draft.StartAt} onChange={value => setDraft({...draft, StartAt: value})} disabled={!canManage || saving} required />
            </div>
            <div className="event-manage-field"><ManageFieldLabel title={t("manage.schedule.scheduledEnd")} help={t("manage.schedule.scheduledEndHelp")} /><EventSwitch className="event-manage-form__switch" checked={draft.ScheduledEnd} onCheckedChange={checked => setDraft({...draft, ScheduledEnd: checked})} disabled={!canManage || saving} label={t("manage.schedule.scheduleEnd")} /></div>
            {draft.ScheduledEnd && <div className="event-manage-fields-two">
                <ManageDateField id="finish-at" title={t("manage.schedule.finish")} help={t("manage.schedule.finishHelp")} value={draft.FinishAt} onChange={value => setDraft({...draft, FinishAt: value})} disabled={!canManage || saving || !draft.ScheduledEnd} required={draft.ScheduledEnd} />
                <ManageDateField id="withdraw-at" title={t("manage.schedule.withdraw")} help={t("manage.schedule.withdrawHelp")} value={draft.WithdrawAt} onChange={value => setDraft({...draft, WithdrawAt: value})} disabled={!canManage || saving || !draft.ScheduledEnd} required={draft.ScheduledEnd} />
            </div>}
            {validation && (draft.PublishAt || draft.StartAt || draft.FinishAt || draft.WithdrawAt) && <p className="event-manage-validation" role="alert">{validation}</p>}
            <div className="event-manage-section__actions"><EventButton className="ib-btn ib-btn--primary" type="submit" disabled={!canManage || saving || config.data?.Participation === null || !!validation || (lifecycle.data.Configured && !dirty)} busy={saving}>{t("manage.schedule.save")}</EventButton></div>
        </form>
    </div>;
}
