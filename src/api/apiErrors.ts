import {z} from "zod";

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
    TeamFieldsInvalid: 1712,
    TeamNotAdmitted: 1713,
    TeamFieldNotEditable: 1714,
    TeamFieldsLocked: 1715,
    ExerciseAlreadyAttached: 1803,
    ExerciseInfrastructureNotAllowed: 1808,
    ExerciseTaskHasAttempts: 1809,
    ExerciseDetachNeedsConfirm: 1810,
    ExerciseNotAvailable: 1811,
    ExerciseNoForkSource: 1812,
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
} as const;

export type ApiErrorCodeValue = typeof ApiErrorCode[keyof typeof ApiErrorCode];

export function errorDetailCode(code: number | undefined): number | undefined {
    return code === undefined ? undefined : code % 10000;
}

export async function readApiErrorCode(response: Response): Promise<number | undefined> {
    const body = z.object({Status: z.object({Code: z.number()})}).safeParse(await response.json().catch(() => null));
    return body.success ? errorDetailCode(body.data.Status.Code) : undefined;
}

// Messages live in messages/errors.{uk,en}.json, keyed by detail code.
export {apiErrorMessage} from "@/i18n/apiError";
