"use client";

import {createContext, useContext, useMemo, useSyncExternalStore, type ReactNode} from "react";
import {useQuery} from "@tanstack/react-query";
import {usePathname, useRouter} from "next/navigation";
import {getCurrentUser} from "@/api/clientAuth";
import {ownTeamSchema} from "@/types/ownTeam";
import {getManageAccess, getManageConfig, type ManageConfig} from "@/api/manage";
import type {ParticipantForm} from "@/api/manageParticipantForm";
import {answerFileSchema, type AnswerFile} from "@/api/answerFiles";
import {z} from "zod";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {Check, LogOut, MoreHorizontal, RotateCcw} from "lucide-react";
import {t} from "@/i18n/t";
import type {JoinOutcome} from "./join/joinPreviewModel";

const STORAGE_KEY = "event-participant-preview-v1";
const PreviewStateSchema = z.object({
    eventID: z.string().min(1), userID: z.string().min(1),
    status: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    outcome: z.enum(["approved", "pending", "rejected"]),
    answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), answerFileSchema])),
    team: ownTeamSchema.nullable(),
});
export type ParticipantPreviewState = z.infer<typeof PreviewStateSchema>;
const CHANGE_EVENT = "event-participant-preview-change";
let volatileSnapshot: string | null = null;
function snapshot() {
    try {return window.sessionStorage.getItem(STORAGE_KEY);} catch {return volatileSnapshot;}
}
function subscribe(onChange: () => void) {
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {window.removeEventListener(CHANGE_EVENT, onChange); window.removeEventListener("storage", onChange);};
}
function parseSnapshot(raw: string | null): ParticipantPreviewState | null {
    try {return PreviewStateSchema.safeParse(JSON.parse(raw ?? "null")).data ?? null;} catch {return null;}
}
function persist(next: ParticipantPreviewState | null) {
    volatileSnapshot = next ? JSON.stringify(next) : null;
    try {
        if (volatileSnapshot) window.sessionStorage.setItem(STORAGE_KEY, volatileSnapshot);
        else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch { /* Restricted browser storage: keep this session in memory. */ }
    window.dispatchEvent(new Event(CHANGE_EVENT));
}
type PreviewContextValue = {
    state: ParticipantPreviewState | null;
    config: ManageConfig | null;
    active: boolean;
    start: (eventID: string, registration?: number) => void;
    update: (patch: Partial<Pick<ParticipantPreviewState, "status" | "outcome" | "answers" | "team">>) => void;
    reset: () => void; exit: () => void;
};
const noop = () => {};
const PreviewContext = createContext<PreviewContextValue>({state: null, config: null, active: false, start: noop, update: noop, reset: noop, exit: noop});
export function useParticipantPreview(eventID?: string) {
    const context = useContext(PreviewContext);
    return {...context, active: context.active && !!context.state && (!eventID || context.state.eventID === eventID)};
}

// This is UI-only state. Never seed auth, participant or team query caches from it.
// Actual task operations keep the real session and the hidden moderators team's API.
export function ParticipantPreviewProvider({children}: {children: ReactNode}) {
    const router = useRouter();
    const pathname = usePathname();
    const identity = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, retry: false, refetchOnWindowFocus: false});
    const raw = useSyncExternalStore(subscribe, snapshot, () => null);
    const saved = useMemo(() => parseSnapshot(raw), [raw]);
    const access = useQuery({queryKey: ["event-management-access", saved?.eventID], queryFn: () => getManageAccess(saved!.eventID), enabled: !!saved && saved.userID === identity.data?.ID, retry: false, refetchOnWindowFocus: false});
    const state = saved && identity.isSuccess && saved.userID === identity.data?.ID && access.isSuccess && access.data.CanManage ? saved : null;
    const config = useQuery({queryKey: ["event-management-config", state?.eventID], queryFn: () => getManageConfig(state!.eventID), enabled: !!state, retry: false, refetchOnWindowFocus: false});
    const exit = () => {persist(null); router.push("/manage");};
    const reset = () => {
        if (!state) return;
        persist({...state, status: 0, answers: {}, team: null});
        router.push("/");
    };
    return <PreviewContext.Provider value={{state, config: config.data ?? null, active: !!state && !/^\/manage(?:\/|$)/.test(pathname), start: (eventID, registration) => {
        if (!identity.data) return;
        persist({eventID, userID: identity.data.ID, status: 0, outcome: registration === 1 ? "pending" : "approved", answers: {}, team: null});
        router.push("/");
    }, update: patch => {const current = parseSnapshot(snapshot()); if (state && current?.userID === state.userID && current.eventID === state.eventID) persist({...current, ...patch, ...(patch.team ? {team: {...patch.team, Admitted: patch.team.MemberCount >= (patch.team.MinTeamSize ?? 1)}} : {})});}, reset, exit}}>
        {state && !pathname.startsWith("/manage") && <div className="event-private-preview-banner event-participant-preview" role="region" aria-label={t("participantPreview.title")}>
            <b className="event-participant-preview__title">{t("participantPreview.title")}</b>
            <DropdownMenu.Root>
                <DropdownMenu.Trigger className="ib-icon-btn ib-icon-btn--sm event-participant-preview__trigger" type="button" aria-label={t("participantPreview.options")}><MoreHorizontal size={20} aria-hidden="true" /></DropdownMenu.Trigger>
                <DropdownMenu.Portal><DropdownMenu.Content className="ib-listbox event-participant-preview__menu" sideOffset={6} align="end" collisionPadding={16}>
                    {(pathname === "/join" || state.status === 1) && <>
                        <DropdownMenu.Label className="event-participant-preview__label">{t("joinPreview.outcome")}</DropdownMenu.Label>
                        <DropdownMenu.RadioGroup value={state.outcome} aria-label={t("joinPreview.outcome")} onValueChange={value => {
                            const outcome = value as JoinOutcome;
                            persist({...state, outcome, status: state.status === 0 ? 0 : outcome === "approved" ? 2 : outcome === "pending" ? 1 : 3});
                        }}>
                            {(["approved", "pending", "rejected"] as const).map(outcome => <DropdownMenu.RadioItem className="ib-listbox__opt event-participant-preview__option" key={outcome} value={outcome}>
                                <span className="event-participant-preview__indicator"><DropdownMenu.ItemIndicator><Check size={16} aria-hidden="true" /></DropdownMenu.ItemIndicator></span>{t(`joinPreview.outcome.${outcome}`)}
                            </DropdownMenu.RadioItem>)}
                        </DropdownMenu.RadioGroup>
                        <DropdownMenu.Separator className="event-participant-preview__separator" />
                    </>}
                    <DropdownMenu.Item className="ib-listbox__opt event-participant-preview__option" onSelect={reset}><RotateCcw size={16} aria-hidden="true" />{t("participantPreview.reset")}</DropdownMenu.Item>
                    <DropdownMenu.Item className="ib-listbox__opt event-participant-preview__option" onSelect={exit}><LogOut size={16} aria-hidden="true" />{t("participantPreview.exit")}</DropdownMenu.Item>
                </DropdownMenu.Content></DropdownMenu.Portal>
            </DropdownMenu.Root>
        </div>}
        {children}
    </PreviewContext.Provider>;
}

export function ParticipantPreviewEntry({eventID, registration}: {eventID: string; registration?: number}) {
    const preview = useParticipantPreview();
    return <button type="button" className="ib-btn ib-btn--sm" onClick={() => preview.start(eventID, registration)}>{t("participantPreview.enter")}</button>;
}

// File answers in test mode keep metadata only; no upload endpoint is called.
export async function previewAnswerFile(file: File): Promise<AnswerFile> {
    return {id: `preview-${crypto.randomUUID()}`, name: file.name, size: file.size, contentType: file.type};
}

export function participantPreviewForm(form: ParticipantForm | null): ParticipantForm | null {
    return form ? {...form, Document: {...form.Document, blocks: form.Document.blocks.filter(block => !(block.type === "field" && block.staffOnly))}} : null;
}

export function previewResultsAvailability(base: import("@/types/resultsAvailability").ResultsAvailability, status: number, config: ManageConfig | null) {
    if (config?.ScoreboardVisibility === 0) return "hidden" as const;
    if (config?.ScoreboardVisibility === 1) return status === 2 ? "available" as const : "participants_only" as const;
    return base === "participants_only" && status === 2 ? "available" as const : base;
}
