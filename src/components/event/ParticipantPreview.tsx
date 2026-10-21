"use client";

import {createContext, useContext, useEffect, useMemo, useSyncExternalStore, useRef, useState, type ReactNode} from "react";
import {useQuery, useQueryClient, type QueryClient} from "@tanstack/react-query";
import {toastFailure} from "@/components/ui/toastApiError";
import {getPreviewBoard, previewBoardKey, resetPreviewRuns, startPreviewRun, stopPreviewRun} from "@/api/participantPreview";
import {previewRunStartsSuspended, suspendPreviewRunStarts} from "@/api/previewRunLifecycle";
import type {OwnBoard} from "@/api/participantChallenges";
import {BusyMark, EventButton} from "@/components/ui/EventButton";
import {usePathname, useRouter} from "next/navigation";
import {getCurrentUser} from "@/api/clientAuth";
import {ownTeamSchema} from "@/types/ownTeam";
import {getManageAccess, getManageConfig, type ManageConfig} from "@/api/manage";
import type {ParticipantForm} from "@/api/manageParticipantForm";
import {answerFileSchema, type AnswerFile} from "@/api/answerFiles";
import {z} from "zod";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {Check, Eye, LogOut, MoreHorizontal, RotateCcw} from "lucide-react";
import {t} from "@/i18n/t";
import type {JoinOutcome} from "./join/joinPreviewModel";
import {readPreviewCookie, setPreviewCookie} from "@/utils/previewCookie";
import {clearParticipantPreview, migratePreviewSnapshot, readPreviewSnapshot as snapshot, subscribePreviewSnapshot as subscribe, writePreviewSnapshot} from "@/utils/previewStorage";

const PreviewStateSchema = z.object({
    eventID: z.string().min(1), userID: z.string().min(1),
    status: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
    outcome: z.enum(["approved", "pending", "rejected"]),
    answers: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), answerFileSchema])),
    team: ownTeamSchema.nullable(),
    // «Показати завдання»: the test task board shows whatever the event phase says and the dynamic tasks' labs run.
    // Off by default: the real phase screens, no test labs.
    tasks: z.boolean().default(false),
    // New entries get an instance identity; legacy saved previews remain readable.
    sessionID: z.string().optional(),
    // Old snapshots predate start-time recording; their historical start cannot be recovered.
    startedAt: z.iso.datetime().optional(),
});
export type ParticipantPreviewState = z.infer<typeof PreviewStateSchema>;
function parseSnapshot(raw: string | null): ParticipantPreviewState | null {
    try {return PreviewStateSchema.safeParse(JSON.parse(raw ?? "null")).data ?? null;} catch {return null;}
}
function persist(next: ParticipantPreviewState | null) {
    if (!next) {clearParticipantPreview(); return;}
    setPreviewCookie(next.eventID);
    writePreviewSnapshot(JSON.stringify(next));
}
// Bind async work to both the browser preview instance and the current query-session authority.
// Query identity/removal is observed synchronously, so A -> B -> A cannot revive retired work.
function previewSessionFence(client: QueryClient, owner: ParticipantPreviewState) {
    const cache = client.getQueryCache();
    const identity = cache.find({queryKey: ["event-current-user"], exact: true});
    const access = cache.find({queryKey: ["event-management-access", owner.eventID], exact: true});
    let retired = false;
    const authorized = () => !!identity && cache.find({queryKey: identity.queryKey, exact: true}) === identity
        && identity.state.status === "success" && (identity.state.data as {ID?: string} | null)?.ID === owner.userID
        && !!access && cache.find({queryKey: access.queryKey, exact: true}) === access
        && access.state.status === "success" && (access.state.data as {CanManage?: boolean} | null)?.CanManage === true;
    const current = () => {
        if (retired || !authorized()) return null;
        const saved = parseSnapshot(snapshot());
        return saved?.eventID === owner.eventID && saved.userID === owner.userID && saved.sessionID === owner.sessionID ? saved : null;
    };
    const unsubscribe = cache.subscribe(event => {
        if ((event.query === identity || event.query === access) && !authorized()) retired = true;
    });
    return {current, valid: () => !!current(), dispose: () => {retired = true; unsubscribe();}};
}
type PreviewOperation = {kind: "reset" | "exit" | "stop"; scope: ReturnType<typeof previewSessionFence>};

type PreviewContextValue = {
    state: ParticipantPreviewState | null;
    config: ManageConfig | null;
    active: boolean;
    // The mode cookie names this event: the staff UI stays hidden, as in the server render, while the state loads.
    hinted: boolean;
    resetting: boolean;
    exiting: boolean;
    exitError: string | null;
    // What the infrastructure switch is doing right now, null when idle.
    infraBusy: "starting" | "stopping" | null;
    setTasks: (on: boolean) => Promise<boolean>;
    start: (eventID: string, registration?: number) => void;
    update: (patch: Partial<Pick<ParticipantPreviewState, "status" | "outcome" | "answers" | "team">>) => void;
    reset: () => void | Promise<boolean>; exit: () => void | Promise<boolean>;
};
const noop = () => {};
// The event named by the mode cookie the server render read, while the browser has not yet confirmed the mode.
const CookieContext = createContext<string | null>(null);
const PreviewContext = createContext<PreviewContextValue>({state: null, config: null, active: false, hinted: false, resetting: false, exiting: false, exitError: null, infraBusy: null, setTasks: async () => false, start: noop, update: noop, reset: noop, exit: noop});
export function useParticipantPreview(eventID?: string) {
    const context = useContext(PreviewContext);
    const cookieEvent = useContext(CookieContext);
    return {...context, active: context.active && !!context.state && (!eventID || context.state.eventID === eventID), hinted: !!cookieEvent && (!eventID || cookieEvent === eventID)};
}

// This is UI-only state. Never seed auth, participant or team query caches from it.
// Actual task operations use isolated per-user preview APIs with the real session.
export function ParticipantPreviewProvider({children, serverCookie = null}: {children: ReactNode; serverCookie?: string | null}) {
    const queryClient = useQueryClient();
    const [resetting, setResetting] = useState(false);
    const [exiting, setExiting] = useState(false);
    const [exitError, setExitError] = useState<string | null>(null);
    const operation = useRef<PreviewOperation | null>(null);
    useEffect(() => () => {operation.current?.scope.dispose(); operation.current = null;}, []);
    const [infraBusy, setInfraBusy] = useState<"starting" | "stopping" | null>(null);
    const router = useRouter();
    const pathname = usePathname();
    const identity = useQuery({queryKey: ["event-current-user"], queryFn: getCurrentUser, retry: false, refetchOnWindowFocus: false});
    const raw = useSyncExternalStore(subscribe, snapshot, () => null);
    const saved = useMemo(() => parseSnapshot(raw), [raw]);
    const access = useQuery({queryKey: ["event-management-access", saved?.eventID], queryFn: () => getManageAccess(saved!.eventID), enabled: !!saved && saved.userID === identity.data?.ID, retry: false, refetchOnWindowFocus: false});
    const state = saved && identity.isSuccess && saved.userID === identity.data?.ID && access.isSuccess && access.data.CanManage ? saved : null;
    // Identity and access still decide whether the saved mode may run. Passive failures never erase the mode.
    const settled = identity.isSuccess && (!saved || saved.userID !== identity.data?.ID || access.isSuccess || access.isError);
    useEffect(() => {
        if (!saved || !raw || snapshot() !== raw) return;
        const migrated = migratePreviewSnapshot(raw);
        // Upgrade only a still-current legacy session cookie, never a snapshot retired in another tab.
        if (migrated && snapshot() === raw && readPreviewCookie() === saved.eventID) setPreviewCookie(saved.eventID);
    }, [saved, raw]);
    useEffect(() => {if (!state && !operation.current) setInfraBusy(null);}, [state]);
    const config = useQuery({queryKey: ["event-management-config", state?.eventID], queryFn: () => getManageConfig(state!.eventID), enabled: !!state, retry: false, refetchOnWindowFocus: false});
    const cleanup = async (kind: "reset" | "exit") => {
        if (!state || operation.current) return false;
        const token: PreviewOperation = {kind, scope: previewSessionFence(queryClient, state)};
        if (!token.scope.valid()) {token.scope.dispose(); return false;}
        operation.current = token;
        const launches = suspendPreviewRunStarts(state.eventID);
        setExitError(null);
        if (kind === "exit") setExiting(true); else setResetting(true);
        try {
            // A POST already sent may create a lab after DELETE; wait for every launch before the final cleanup.
            await launches.drain();
            if (!token.scope.valid()) return false;
            await resetPreviewRuns(state.eventID);
            if (!token.scope.valid()) return false;
            const belongsToPreview = (key: readonly unknown[]) =>
                (["event-participant-preview-board", "event-preview-results", "event-preview-vpn-lab"].includes(String(key[0])) && key[1] === state.eventID)
                || (key[1] === "preview" && key[2] === state.eventID);
            await queryClient.cancelQueries({predicate: query => belongsToPreview(query.queryKey)});
            if (!token.scope.valid()) return false;
            queryClient.removeQueries({predicate: query => belongsToPreview(query.queryKey)});
            const current = token.scope.current();
            if (!current) return false;
            persist(kind === "exit" ? null : {...current, startedAt: new Date().toISOString(), status: 0, answers: {}, team: null, tasks: false});
            router.push(kind === "exit" ? "/manage" : "/");
            return true;
        } catch (failure) {
            if (!token.scope.valid()) return false;
            if (kind === "exit") setExitError(t("participantPreview.exitFailed"));
            toastFailure(failure, t(kind === "exit" ? "participantPreview.exitFailed" : "participantPreview.resetFailed"));
            return false;
        } finally {
            launches.release(); token.scope.dispose();
            if (operation.current === token) {
                operation.current = null;
                if (kind === "exit") setExiting(false); else setResetting(false);
                setInfraBusy(null);
            }
        }
    };
    const exit = () => cleanup("exit");
    const reset = () => cleanup("reset");
    // On: persisted, the runner below launches the labs. Off: the owned dynamic labs end first, then the switch flips.
    const setTasks = async (on: boolean) => {
        if (!state || operation.current) return false;
        const scope = previewSessionFence(queryClient, state);
        const persistTasks = () => {
            const current = scope.current();
            if (!current) return false;
            persist({...current, tasks: on});
            return true;
        };
        if (on) {try {return persistTasks();} finally {scope.dispose();}}
        const token: PreviewOperation = {kind: "stop", scope};
        if (!scope.valid()) {scope.dispose(); return false;}
        operation.current = token;
        const launches = suspendPreviewRunStarts(state.eventID);
        setInfraBusy("stopping");
        try {
            await launches.drain();
            if (!scope.valid()) return false;
            const stopped = await stopPreviewLabs(queryClient, state.eventID, scope.valid);
            return stopped && persistTasks();
        } catch (failure) {if (scope.valid()) toastFailure(failure, t("participantPreview.infra.stopFailed")); return false;}
        finally {
            launches.release(); scope.dispose();
            if (operation.current === token) {operation.current = null; setInfraBusy(null);}
        }
    };
    // The hint comes only from the cookie the SERVER rendered with, and only until the identity and access answers
    // are in: it covers the first HTML and hydration. A client navigation (the server layout is not re-rendered)
    // starts with no hint and behaves as before the cookie existed.
    const hint = !settled && !state ? serverCookie : null;
    return <CookieContext.Provider value={hint}><PreviewContext.Provider value={{state, hinted: !!hint, config: config.data ?? null, resetting, exiting, exitError, infraBusy, setTasks, active: !!state && !/^\/manage(?:\/|$)/.test(pathname), start: (eventID, registration) => {
        const live = queryClient.getQueryState<{ID: string}>(["event-current-user"]);
        if (operation.current || !identity.isSuccess || !identity.data || live?.status !== "success" || live.data?.ID !== identity.data.ID) return;
        setInfraBusy(null); setExitError(null);
        persist({sessionID: crypto.randomUUID(), startedAt: new Date().toISOString(), eventID, userID: identity.data.ID, status: 0, outcome: registration === 1 ? "pending" : "approved", answers: {}, team: null, tasks: false});
        router.push("/");
    }, update: patch => {const current = parseSnapshot(snapshot()); if (state && current?.userID === state.userID && current.eventID === state.eventID) persist({...current, ...patch, ...(patch.team ? {team: {...patch.team, Admitted: patch.team.MemberCount >= (patch.team.MinTeamSize ?? 1)}} : {})});}, reset, exit}}>
        {state && !pathname.startsWith("/manage") && <div className="event-private-preview-banner event-participant-preview" role="region" aria-label={t("participantPreview.title")}>
            <b className="event-participant-preview__title">{t("participantPreview.title")}</b>
            <ParticipantPreviewMenu />
        </div>}
        {state?.tasks && !/^\/manage(?:\/|$)/.test(pathname) && <PreviewInfrastructure owner={state} stopping={resetting || exiting || infraBusy === "stopping"} onBusy={busy => {if (!operation.current) setInfraBusy(busy);}} />}
        {children}
    </PreviewContext.Provider></CookieContext.Provider>;
}

const previewRuntimeCache = (key: readonly unknown[], eventID: string) => key[1] === "preview" && key[2] === eventID;

// Ends the owned dynamic labs of the test tasks (static progress stays). Returns false when any of them failed to end.
async function stopPreviewLabs(queryClient: QueryClient, eventID: string, current: () => boolean): Promise<boolean> {
    const key = previewBoardKey(eventID);
    const board: OwnBoard = queryClient.getQueryData<OwnBoard>(key) ?? await getPreviewBoard(eventID);
    if (!current()) return false;
    const running = [...new Set(board.Challenges.filter(task => task.PreviewDynamic && task.PreviewRunID && task.PreviewSelectionID).map(task => task.PreviewSelectionID!))];
    const results = await Promise.allSettled(running.map(id => stopPreviewRun(eventID, id)));
    if (!current()) return false;
    const ended = new Set(running.filter((_, index) => results[index].status === "fulfilled"));
    queryClient.setQueryData<OwnBoard>(key, current => current && ({...current, Challenges: current.Challenges.map(task => task.PreviewSelectionID && ended.has(task.PreviewSelectionID) ? {...task, PreviewRunID: null, PreviewExpiresAt: null} : task)}));
    if (!current()) return false;
    queryClient.removeQueries({predicate: query => previewRuntimeCache(query.queryKey, eventID)});
    const failed = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failed) throw failed.reason;
    return true;
}

// While the switch is on, launches the labs of the dynamic test tasks that have no run, once per task: a lease that
// ended is not relaunched by itself, and a failed launch is told once, not retried in a loop.
function PreviewInfrastructure({owner, stopping, onBusy}: {owner: ParticipantPreviewState; stopping: boolean; onBusy: (busy: "starting" | null) => void}) {
    const queryClient = useQueryClient();
    const eventID = owner.eventID;
    const mounted = useRef(true);
    useEffect(() => {mounted.current = true; return () => {mounted.current = false;};}, []);
    const key = useMemo(() => previewBoardKey(eventID), [eventID]);
    const board = useQuery({queryKey: key, queryFn: () => getPreviewBoard(eventID), retry: false, refetchInterval: 10000});
    const attempted = useRef(new Set<string>());
    const working = useRef(false);
    const data = board.data;
    useEffect(() => {
        if (!data || working.current || stopping || previewRunStartsSuspended(eventID)) return;
        const wanted = [...new Set(data.Challenges.filter(task => task.PreviewDynamic && task.PreviewCanStart === true && !task.PreviewRunID && task.PreviewSelectionID).map(task => task.PreviewSelectionID!))]
            .filter(id => !attempted.current.has(id));
        if (wanted.length === 0) return;
        const scope = previewSessionFence(queryClient, owner);
        const current = () => mounted.current && scope.valid();
        if (!current()) {scope.dispose(); return;}
        wanted.forEach(id => attempted.current.add(id));
        working.current = true;
        onBusy("starting");
        void (async () => {
            try {
                for (const id of wanted) {
                    if (previewRunStartsSuspended(eventID) || !current()) break;
                    const run = await startPreviewRun(eventID, id);
                    if (!current()) break;
                    queryClient.setQueryData<OwnBoard>(key, current => current && ({...current, Challenges: current.Challenges.map(task => task.PreviewSelectionID === id ? {...task, PreviewRunID: run.ID, PreviewExpiresAt: run.ExpiresAt} : task)}));
                }
            } catch (failure) {if (current()) toastFailure(failure, t("participantPreview.infra.startFailed"));}
            finally {working.current = false; if (current()) onBusy(null); scope.dispose();}
        })();
    }, [data, stopping, eventID, owner, queryClient, key, onBusy]);
    return null;
}

export function ParticipantPreviewEntry({eventID, registration}: {eventID: string; registration?: number}) {
    const preview = useParticipantPreview();
    // On a phone the top bar keeps only the icon; the label stays the accessible name.
    return <EventButton type="button" className="ib-btn ib-btn--sm event-preview-entry" busy={preview.exiting || preview.resetting || preview.infraBusy === "stopping"} busyLabel={t(preview.exiting ? "participantPreview.exiting" : preview.resetting ? "participantPreview.resetting" : "participantPreview.infra.stopping")} onClick={() => preview.start(eventID, registration)}><Eye size={16} aria-hidden="true" /><span className="event-preview-entry__label">{t("participantPreview.enter")}</span></EventButton>;
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

// Also rendered inside registration's native dialog: global controls outside
// the top layer are inert. The dropdown must portal into that same dialog.
export function ParticipantPreviewMenu() {
    const preview = useContext(PreviewContext);
    const pathname = usePathname();
    const trigger = useRef<HTMLButtonElement>(null);
    const [container, setContainer] = useState<HTMLElement | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const state = preview.state;
    if (!state) return null;
    return <DropdownMenu.Root open={menuOpen} onOpenChange={open => {setMenuOpen(open); if (open) setContainer(trigger.current?.closest("dialog") ?? null);}}>
                <DropdownMenu.Trigger ref={trigger} className="ib-icon-btn ib-icon-btn--sm event-participant-preview__trigger" type="button" aria-label={t("participantPreview.options")}><MoreHorizontal size={20} aria-hidden="true" /></DropdownMenu.Trigger>
                <DropdownMenu.Portal container={container}><DropdownMenu.Content className="ib-listbox event-participant-preview__menu" sideOffset={6} align="end" collisionPadding={16}>
                    {(pathname === "/join" || state.status === 1) && <>
                        <DropdownMenu.Label className="event-participant-preview__label">{t("joinPreview.outcome")}</DropdownMenu.Label>
                        <DropdownMenu.RadioGroup value={state.outcome} aria-label={t("joinPreview.outcome")} onValueChange={value => {
                            const outcome = value as JoinOutcome;
                            preview.update({outcome, status: state.status === 0 ? 0 : outcome === "approved" ? 2 : outcome === "pending" ? 1 : 3});
                        }}>
                            {(["approved", "pending", "rejected"] as const).map(outcome => <DropdownMenu.RadioItem className="ib-listbox__opt event-participant-preview__option" key={outcome} value={outcome}>
                                <span className="event-participant-preview__indicator"><DropdownMenu.ItemIndicator><Check size={16} aria-hidden="true" /></DropdownMenu.ItemIndicator></span>{t(`joinPreview.outcome.${outcome}`)}
                            </DropdownMenu.RadioItem>)}
                        </DropdownMenu.RadioGroup>
                        <DropdownMenu.Separator className="event-participant-preview__separator" />
                    </>}
                    <DropdownMenu.CheckboxItem className="ib-listbox__opt event-participant-preview__option" checked={state.tasks} disabled={!!preview.infraBusy || preview.resetting || preview.exiting} aria-busy={!!preview.infraBusy || undefined}
                        onSelect={event => event.preventDefault()} onCheckedChange={on => void preview.setTasks(on)}>
                        <span className="event-participant-preview__indicator">{preview.infraBusy ? <BusyMark /> : <DropdownMenu.ItemIndicator><Check size={16} aria-hidden="true" /></DropdownMenu.ItemIndicator>}</span>
                        {t(preview.infraBusy === "starting" ? "participantPreview.infra.starting" : preview.infraBusy === "stopping" ? "participantPreview.infra.stopping" : "participantPreview.tasks")}
                    </DropdownMenu.CheckboxItem>
                    <DropdownMenu.Item className="ib-listbox__opt event-participant-preview__option" disabled={preview.resetting || preview.exiting || preview.infraBusy === "stopping"} aria-busy={preview.resetting || undefined} onSelect={event => {event.preventDefault(); void Promise.resolve(preview.reset()).then(success => {if (success) setMenuOpen(false);});}}>{preview.resetting ? <BusyMark /> : <RotateCcw size={16} aria-hidden="true" />}{t(preview.resetting ? "participantPreview.resetting" : "participantPreview.reset")}</DropdownMenu.Item>
                    <DropdownMenu.Item className="ib-listbox__opt event-participant-preview__option" disabled={preview.resetting || preview.exiting || preview.infraBusy === "stopping"} aria-busy={preview.exiting || undefined} onSelect={event => {event.preventDefault(); void Promise.resolve(preview.exit()).then(success => {if (success) setMenuOpen(false);});}}>{preview.exiting ? <BusyMark /> : <LogOut size={16} aria-hidden="true" />}{t(preview.exiting ? "participantPreview.exiting" : "participantPreview.exit")}</DropdownMenu.Item>
                    {preview.exitError && <div className="event-manage-validation" role="alert">{preview.exitError}</div>}
                </DropdownMenu.Content></DropdownMenu.Portal>
            </DropdownMenu.Root>;
}
