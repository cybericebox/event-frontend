import {z} from "zod";
import {isOverloadError, parseRetryAfterSeconds} from "./retry";

// Backend full codes are informCode*10000 + objectCode*100 + detailCode.
// The UI matches on objectCode*100 + detailCode so a changed HTTP class
// (informCode) never breaks a message.
export const ApiErrorCode = {
    RegistrationClosed: 1301,
    AlreadyParticipant: 1303,
    ParticipantFormRequired: 1309,
    InvitationRequired: 1310,
    TeamInvitationUnavailable: 1312,
    InvitationExpired: 1313,
    PseudonymsDisabled: 1314,
    PseudonymInvalid: 1315,
    PseudonymTaken: 1316,
    PseudonymLocked: 1317,
    EventFormRequired: 1318,
    ParticipantFieldNotEditable: 1320,
    ParticipantFieldsLocked: 1321,
    ParticipantAnswersInvalid: 1322,
    TeamNameInvalid: 1702,
    TeamFull: 1706,
    TeamNotFound: 1707,
    TeamExists: 1709,
    RosterLocked: 1710,
    TeamSwitchLocked: 1720,
    TeamFormed: 1721,
    TeamBelowMinimum: 1722,
    TeamNotFormed: 1723,
    TeamFieldsInvalid: 1712,
    TeamNotAdmitted: 1713,
    ParticipantNotApproved: 1306,
    InfrastructureUnavailable: 1401,
    ChallengeNotPublished: 1910,
    StandLabClientMissing: 2008,
    TeamFieldNotEditable: 1714,
    TeamFieldsLocked: 1715,
    ExerciseAlreadyAttached: 1803,
    ExerciseInfrastructureNotAllowed: 1808,
    ExerciseTaskHasAttempts: 1809,
    ExerciseDetachNeedsConfirm: 1810,
    ExerciseNotAvailable: 1811,
    ExerciseNoForkSource: 1812,
    // A running stage: its prepared teams' stands are recreated only on confirmation.
    ExerciseStandsRunning: 1813,
    ResultsHidden: 1213,
    ResultsParticipantsOnly: 1214,
    ResultsNotStarted: 1215,
    ChallengeNotFound: 1903,
    ChallengePrerequisites: 1912,
    NothingToAnnul: 1930,
    HintCostsInvalid: 1931,
    HintNotFound: 1932,
    HintsDisabled: 1933,
    MailSMTPInvalid: 2101,
    MailSecretsKeyMissing: 2102,
    MailNotificationRequired: 2103,
    MailSettingsInvalid: 2104,
    EventAnalyticsSolveNotFound: 2205,
    EventAnalyticsReviewNoteTooLong: 2206,
    EventAnalyticsPatternNotDismissible: 2207,
    BroadcastNotFound: 220,
    BroadcastInvalid: 221,
    BroadcastEmptyAudience: 222,
    BannerNotFound: 223,
    BannerInvalid: 224,
    TemplateLinkInvalid: 225,
    AuthTooManyRequests: 428,
    NameInvalidCharacters: 304,
    AnswerTooLong: 1937,
    AttemptLimitInvalid: 1938,
    AttemptLimitReached: 1939,
    ImageTooManyPixels: 1004,
    ImageUnreadable: 1005,
    PresetNested: 226,
    // Event stages: opened/closed stages refuse the change (what the stage allows depends on its state).
    StageOverlap: 1145,
    StageNameExists: 1146,
    StageAnchor: 1147,
    StageClosedLocked: 1148,
    StageOpenedLocked: 1149,
    StageNotDeletable: 1150,
    StageNeedsFinish: 1151,
    StageClosed: 1940,
    // The same idempotency key is still being processed (an answer, a Lab command): ask again shortly.
    AnswerInProgress: 1926,
    LabCommandInProgress: 2620,
} as const;

export type ApiErrorCodeValue = typeof ApiErrorCode[keyof typeof ApiErrorCode];

export function errorDetailCode(code: number | undefined): number | undefined {
    return code === undefined ? undefined : code % 10000;
}

// Seconds to wait from the Retry-After header of a 429 or an overload 503 (the header is exposed by CORS):
// whole seconds, 0 allowed, an HTTP-date too; undefined without it. Every error class keeps it as `retryAfter`
// (the port contract of api/retry.ts), so isOverloadError and the overloaded message see it.
export function readRetryAfter(response: Response): number | undefined {
    return parseRetryAfterSeconds(response.headers?.get("Retry-After") ?? null);
}

// A failure the server answered as busy or over a limit (a 429, the overload signal): the client already retried the
// GET (fetchWithOverloadRetry), so React Query must not add more tries. Not for messages: a 429 keeps its own text.
export function isOverloadOrRateLimit(error: unknown): boolean {
    return isOverloadError(error) || (error instanceof Error && (error as {status?: unknown}).status === 429);
}

// The detail code and the public context (what the server marked safe to show, e.g. the teams of a conflict) of an error answer.
export async function readApiError(response: Response): Promise<{code?: number; context?: Record<string, unknown>}> {
    const body = z.object({Status: z.object({Code: z.number(), Context: z.record(z.string(), z.unknown()).nullish()})}).safeParse(await response.json().catch(() => null));
    if (body.success) return {code: errorDetailCode(body.data.Status.Code), context: body.data.Status.Context ?? undefined};
    // The token-bucket limiter answers a bare 429 without a body.
    return {code: response.status === 429 ? ApiErrorCode.AuthTooManyRequests : undefined};
}

export async function readApiErrorCode(response: Response): Promise<number | undefined> {
    return (await readApiError(response)).code;
}

// Messages live in messages/errors.{uk,en}.json, keyed by detail code.
import {apiErrorMessage} from "@/i18n/apiError";
export {apiErrorMessage, apiErrorText, overloadedMessage, waitText} from "@/i18n/apiError";

// Picture upload failures that have their own message (too many pixels, unreadable); anything else keeps the caller's text.
export function imageUploadMessage(error: unknown, fallback: string): string {
    const code = typeof error === "object" && error !== null && "code" in error ? (error as {code?: number}).code : undefined;
    return code === ApiErrorCode.ImageTooManyPixels || code === ApiErrorCode.ImageUnreadable ? apiErrorMessage(code, fallback) : fallback;
}
