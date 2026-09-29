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
    NothingToAnnul: 1930,
    MailSMTPInvalid: 2101,
    MailSecretsKeyMissing: 2102,
    MailNotificationRequired: 2103,
    MailSettingsInvalid: 2104,
} as const;

export type ApiErrorCodeValue = typeof ApiErrorCode[keyof typeof ApiErrorCode];

export function errorDetailCode(code: number | undefined): number | undefined {
    return code === undefined ? undefined : code % 10000;
}

export async function readApiErrorCode(response: Response): Promise<number | undefined> {
    const body = z.object({Status: z.object({Code: z.number()})}).safeParse(await response.json().catch(() => null));
    return body.success ? errorDetailCode(body.data.Status.Code) : undefined;
}

const messages: Partial<Record<number, string>> = {
    [ApiErrorCode.RegistrationClosed]: "Реєстрацію на подію закрито.",
    [ApiErrorCode.AlreadyParticipant]: "Ви вже берете участь у події.",
    [ApiErrorCode.ParticipantFormRequired]: "Заповніть обов’язкові додаткові поля.",
    [ApiErrorCode.EventFormRequired]: "Заповніть обов’язкові додаткові поля.",
    [ApiErrorCode.InvitationRequired]: "Запрошення не знайдено або вже використано.",
    [ApiErrorCode.TeamInvitationUnavailable]: "Команда, до якої вас запросили, більше недоступна.",
    [ApiErrorCode.InvitationExpired]: "Запрошення прострочене: реєстрацію закрито.",
    [ApiErrorCode.PseudonymsDisabled]: "Псевдоніми на цій події вимкнено.",
    [ApiErrorCode.PseudonymInvalid]: "Псевдонім має містити від 2 до 32 символів.",
    [ApiErrorCode.PseudonymTaken]: "Цей псевдонім уже зайнятий.",
    [ApiErrorCode.PseudonymLocked]: "Псевдонім не можна змінити після старту події.",
    [ApiErrorCode.ParticipantFieldNotEditable]: "Це поле не можна змінити після реєстрації.",
    [ApiErrorCode.ParticipantFieldsLocked]: "Поля не можна змінити після завершення події.",
    [ApiErrorCode.ParticipantAnswersInvalid]: "Перевірте заповнені поля.",
    [ApiErrorCode.TeamNameInvalid]: "Назва команди некоректна.",
    [ApiErrorCode.TeamFull]: "Команда вже заповнена.",
    [ApiErrorCode.TeamNotFound]: "Команду не знайдено.",
    [ApiErrorCode.TeamExists]: "Команда з такою назвою вже існує.",
    [ApiErrorCode.RosterLocked]: "Склад команди заморожено після старту.",
    [ApiErrorCode.TeamFieldsInvalid]: "Перевірте додаткові поля команди.",
    [ApiErrorCode.TeamNotAdmitted]: "Команду ще не допущено до завдань.",
    [ApiErrorCode.TeamFieldNotEditable]: "Це поле команди не можна змінити після створення.",
    [ApiErrorCode.TeamFieldsLocked]: "Поля команди не можна змінити після завершення події.",
    [ApiErrorCode.MailSMTPInvalid]: "Перевірте хост, порт і режим TLS.",
    [ApiErrorCode.MailSecretsKeyMissing]: "Пароль SMTP не можна зберегти: на платформі не налаштовано ключ шифрування.",
    [ApiErrorCode.MailNotificationRequired]: "Це сповіщення обовʼязкове, його не можна вимкнути.",
    [ApiErrorCode.MailSettingsInvalid]: "Перевірте контактну пошту й години нагадування.",
};

// Returns a user-facing message for a known backend code, or the fallback.
export function apiErrorMessage(code: number | undefined, fallback: string): string {
    return (code !== undefined && messages[code]) || fallback;
}
