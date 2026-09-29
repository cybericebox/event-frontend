"use client";

import {useState, type FormEvent} from "react";
import {useQuery, useQueryClient} from "@tanstack/react-query";
import {toast} from "react-hot-toast";
import {
    getManageConfig, getManageLifecycle, getManageScoring, manageConfigInput, putManageConfig, putManageScoring,
    type ManageConfig, type ManageScoring, type ManageScoringInput,
} from "@/api/manage";
import {EventLoading} from "@/components/event/EventLoading";
import {ManageFieldLabel} from "@/components/event/manage/ManageFieldLabel";
import {useManager} from "@/components/event/manage/ManagerShell";
import {withTimeDecayFloor} from "@/components/event/manage/scoringFloor";
import {EventButton} from "@/components/ui/EventButton";
import {EventSelect} from "@/components/ui/EventSelect";
import {EventSwitch} from "@/components/ui/EventSwitch";
import {t} from "@/i18n/t";
import {decayOptions, decayProblem, dynamicErrors, dynamicValid, numberOf, staticPointsValid, type ScoringMode} from "./scoringModel";
import "./challengesManage.css";

type ScoringDraft = {Mode: ScoringMode; StaticPoints: string; MinPoints: number; MaxPoints: number; FloorAtPercent: number; ForceEventScoring: boolean};

// An empty field stays empty (NaN) instead of showing NaN.
const shown = (value: number) => Number.isNaN(value) ? "" : value;

function draftOf(value: ManageScoring): ScoringDraft {
    return {Mode: value.Mode, StaticPoints: value.StaticPoints === null ? "" : String(value.StaticPoints), MinPoints: value.MinPoints, MaxPoints: value.MaxPoints, FloorAtPercent: value.FloorAtPercent, ForceEventScoring: value.ForceEventScoring};
}

function inputOf(draft: ScoringDraft): ManageScoringInput {
    const raw = draft.StaticPoints.trim();
    return withTimeDecayFloor({Mode: draft.Mode, MinPoints: draft.MinPoints, MaxPoints: draft.MaxPoints, FloorAtPercent: draft.FloorAtPercent, ForceEventScoring: draft.ForceEventScoring, StaticPoints: raw === "" ? null : Number(raw)});
}

const chargeModes = () => ([
    {value: "reward", label: t("manage.board.charge.reward"), note: t("manage.board.charge.rewardNote")},
    {value: "balance", label: t("manage.board.charge.balance"), note: t("manage.board.charge.balanceNote")},
] as const);

// «Налаштування» of the challenges group: event scoring («Оцінювання»),
// hints and what the board shows.
export function ChallengeSettings() {
    const {event, canManage} = useManager();
    const eventID = event.EventID;
    const queryClient = useQueryClient();
    const scoring = useQuery({queryKey: ["event-management-scoring", eventID], queryFn: () => getManageScoring(eventID), refetchOnWindowFocus: false});
    const lifecycle = useQuery({queryKey: ["event-management-lifecycle", eventID], queryFn: () => getManageLifecycle(eventID), refetchOnWindowFocus: false});
    const config = useQuery({queryKey: ["event-management-config", eventID], queryFn: () => getManageConfig(eventID), refetchOnWindowFocus: false});
    const [edit, setEdit] = useState<{eventID: string; value: ScoringDraft} | null>(null);
    const [saving, setSaving] = useState(false);
    const [savingConfig, setSavingConfig] = useState(false);

    if (scoring.isPending || lifecycle.isPending || config.isPending) return <EventLoading event={event} />;
    if (scoring.isError || lifecycle.isError || config.isError) return <div className="event-manage-error" role="alert"><h1>{t("manage.challenges.settings.loadFailed")}</h1><button className="ib-btn" type="button" onClick={() => {void scoring.refetch(); void lifecycle.refetch(); void config.refetch();}}>{t("common.retry")}</button></div>;

    const original = draftOf(scoring.data);
    const value = edit?.eventID === eventID ? edit.value : original;
    const dirty = JSON.stringify(inputOf(value)) !== JSON.stringify(inputOf(original));
    const dynamic = value.Mode !== 0;
    const problem = dynamic ? decayProblem(value.Mode, lifecycle.data) : "";
    const valid = dynamic ? dynamicValid(value) : staticPointsValid(value.StaticPoints, true);
    const errors = dynamic ? dynamicErrors(value) : {max: "", min: "", floor: ""};
    const disabled = !canManage || saving;
    const update = (patch: Partial<ScoringDraft>) => setEdit({eventID, value: {...value, ...patch}});

    async function save(submitEvent: FormEvent<HTMLFormElement>) {
        submitEvent.preventDefault();
        if (!dirty || !valid || problem || disabled) return;
        setSaving(true);
        try {
            queryClient.setQueryData(["event-management-scoring", eventID], await putManageScoring(eventID, inputOf(value)));
            setEdit(null);
            toast.success(t("manage.challenges.scoring.saved"));
        } catch {toast.error(t("manage.challenges.scoring.saveFailed"));}
        finally {setSaving(false);}
    }

    async function saveConfig(patch: Partial<Pick<ManageConfig, "ShowDifficulty" | "HintsDisabled" | "HintChargeMode">>) {
        if (!config.data || savingConfig || !canManage) return;
        setSavingConfig(true);
        try {
            queryClient.setQueryData(["event-management-config", eventID], await putManageConfig(eventID, {...manageConfigInput(config.data), ...patch}));
        } catch {toast.error(t("manage.board.saveFailed"));}
        finally {setSavingConfig(false);}
    }

    return <div className="event-manage-settings event-manage-general event-challenge-settings">
        <header className="event-manage-heading"><div><h1>{t("manage.challenges.settings.title")}</h1><p>{t("manage.challenges.settings.subtitle")}</p></div></header>
        <form className="event-manage-section" aria-labelledby="scoring-title" onSubmit={save}>
            <div className="event-manage-section__head"><h2 id="scoring-title">{t("manage.challenges.scoring.title")}</h2><p>{t("manage.challenges.scoring.subtitle")}</p></div>
            <fieldset className="event-challenge-settings__kind" disabled={disabled}>
                <legend className="event-manage-visually-hidden">{t("manage.challenges.scoring.kind")}</legend>
                <div className="event-manage-choice-group">
                    <label><input type="radio" name="scoring-kind" checked={!dynamic} onChange={() => update({Mode: 0})} /><span><strong>{t("manage.challenges.scoring.static")}</strong><small>{t("manage.challenges.scoring.staticNote")}</small></span></label>
                    <label><input type="radio" name="scoring-kind" checked={dynamic} onChange={() => update({Mode: 1, MinPoints: value.MinPoints || 100, MaxPoints: value.MaxPoints || 500, FloorAtPercent: value.FloorAtPercent || 50})} /><span><strong>{t("manage.challenges.scoring.dynamic")}</strong><small>{t("manage.challenges.scoring.dynamicNote")}</small></span></label>
                </div>
            </fieldset>
            {!dynamic && <div className="event-challenge-settings__fields">
                <div className="event-manage-field"><ManageFieldLabel htmlFor="static-points" title={t("manage.challenges.scoring.staticPoints")} help={t("manage.challenges.scoring.staticPointsHelp")} required />
                    <input id="static-points" className="event-manage-input" type="number" inputMode="numeric" min={1} step={1} required value={value.StaticPoints} aria-invalid={!valid} aria-describedby={!valid ? "static-points-error" : undefined} onChange={changeEvent => update({StaticPoints: changeEvent.target.value})} disabled={disabled} /></div>
            </div>}
            {dynamic && <div className="event-challenge-settings__fields">
                <div className="event-manage-field"><ManageFieldLabel title={t("manage.challenges.scoring.decay")} help={t("manage.scoring.modeHelp")} />
                    <EventSelect ariaLabel={t("manage.challenges.scoring.decay")} value={String(value.Mode)} options={decayOptions()} onValueChange={mode => update({Mode: Number(mode) as ScoringMode})} disabled={disabled} /></div>
                <div className={value.Mode === 3 ? "event-manage-fields-two" : "event-manage-fields-three"}>
                    <div className="event-manage-field"><ManageFieldLabel htmlFor="score-max" title={t("manage.scoring.max")} help={t("manage.scoring.maxHelp")} required />
                        <input id="score-max" className="event-manage-input" type="number" min={1} step={1} required value={shown(value.MaxPoints)} aria-invalid={!!errors.max} aria-describedby={errors.max ? "score-max-error" : undefined} onChange={changeEvent => update({MaxPoints: numberOf(changeEvent.target.value)})} disabled={disabled} />
                        {errors.max && <p className="event-manage-validation" id="score-max-error" role="alert">{errors.max}</p>}</div>
                    <div className="event-manage-field"><ManageFieldLabel htmlFor="score-min" title={t("manage.scoring.min")} help={t("manage.scoring.minHelp")} required />
                        <input id="score-min" className="event-manage-input" type="number" min={0} step={1} required value={shown(value.MinPoints)} aria-invalid={!!errors.min} aria-describedby={errors.min ? "score-min-error" : undefined} onChange={changeEvent => update({MinPoints: numberOf(changeEvent.target.value)})} disabled={disabled} />
                        {errors.min && <p className="event-manage-validation" id="score-min-error" role="alert">{errors.min}</p>}</div>
                    {value.Mode !== 3 && <div className="event-manage-field"><ManageFieldLabel htmlFor="score-floor" title={t("manage.scoring.floor")} help={t("manage.scoring.floorHelp")} required />
                        <input id="score-floor" className="event-manage-input" type="number" min={1} max={100} step={1} required value={shown(value.FloorAtPercent)} aria-invalid={!!errors.floor} aria-describedby={errors.floor ? "score-floor-error" : undefined} onChange={changeEvent => update({FloorAtPercent: numberOf(changeEvent.target.value)})} disabled={disabled} />
                        {errors.floor && <p className="event-manage-validation" id="score-floor-error" role="alert">{errors.floor}</p>}</div>}
                </div>
            </div>}
            {problem && <p className="event-manage-feedback event-manage-feedback--error" role="alert">{problem}</p>}
            {!dynamic && !valid && <p className="event-manage-validation" id="static-points-error" role="alert">{t("manage.challenges.scoring.staticInvalid")}</p>}
            <div className="event-challenge-settings__force">
                <EventSwitch className="event-manage-form__switch" checked={value.ForceEventScoring} onCheckedChange={checked => update({ForceEventScoring: checked})} disabled={disabled} label={t("manage.challenges.scoring.force")} />
                <p>{t("manage.challenges.scoring.forceNote")}</p>
            </div>
            {(dirty || saving) && <div className="event-manage-savebar"><EventButton className="ib-btn ib-btn--primary" type="submit" disabled={disabled || !valid || !!problem} busy={saving}>{t("common.save")}</EventButton></div>}
        </form>
        <section className="event-manage-section" aria-labelledby="hints-title">
            <div className="event-manage-section__head"><h2 id="hints-title">{t("manage.challenges.hints.title")}</h2><p>{t("manage.challenges.hints.subtitle")}</p></div>
            <div className="event-challenge-settings__switch">
                <EventSwitch className="event-manage-form__switch" checked={config.data.HintsDisabled} disabled={!canManage || savingConfig} onCheckedChange={checked => void saveConfig({HintsDisabled: checked})} label={t("manage.challenges.hints.disableAll")} />
                <p>{t("manage.challenges.hints.disableAllNote")}</p>
            </div>
            <fieldset className="event-hint-charge" disabled={!canManage || savingConfig}>
                <legend>{t("manage.board.chargeLegend")}</legend>
                <div className="event-manage-choice-group">{chargeModes().map(mode => <label key={mode.value}><input type="radio" name="hint-charge-mode" value={mode.value} checked={config.data.HintChargeMode === mode.value} onChange={() => void saveConfig({HintChargeMode: mode.value})} /><span><strong>{mode.label}</strong><small>{mode.note}</small></span></label>)}</div>
            </fieldset>
        </section>
        <section className="event-manage-section" aria-labelledby="board-title">
            <div className="event-manage-section__head"><h2 id="board-title">{t("manage.challenges.display.title")}</h2><p>{t("manage.board.subtitle")}</p></div>
            <EventSwitch className="event-manage-form__switch" checked={config.data.ShowDifficulty} disabled={!canManage || savingConfig} onCheckedChange={checked => void saveConfig({ShowDifficulty: checked})} label={t("manage.board.showDifficulty")} />
        </section>
    </div>;
}
