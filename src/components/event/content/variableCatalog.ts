import type {ContentValue} from "@/types/eventContent";

export type ContentVariableFormat = "text" | "number" | "date-time" | "boolean";
export type ContentVariableDefinition = {name: string; label: string; format: ContentVariableFormat};

// Keep this public-page catalog aligned with publicContentVariableNames in the API.
// Manager-only raw counts are intentionally omitted from the page editor.
export const contentVariableCatalog: ContentVariableDefinition[] = [
    {name: "event.name", label: "Назва події", format: "text"},
    {name: "event.tag", label: "Тег події", format: "text"},
    {name: "event.previewDescription", label: "Короткий опис", format: "text"},
    {name: "event.phase", label: "Поточний етап", format: "text"},
    {name: "event.publishAt", label: "Час публікації", format: "date-time"},
    {name: "event.startAt", label: "Час початку", format: "date-time"},
    {name: "event.finishAt", label: "Заплановане завершення", format: "date-time"},
    {name: "event.withdrawAt", label: "Закриття доступу", format: "date-time"},
    {name: "event.manualFinishAt", label: "Ручне завершення", format: "date-time"},
    {name: "event.effectiveFinishAt", label: "Фактичне завершення", format: "date-time"},
    {name: "event.isPublished", label: "Опубліковано", format: "boolean"},
    {name: "event.isStarted", label: "Розпочато", format: "boolean"},
    {name: "event.isFinished", label: "Завершено", format: "boolean"},
    {name: "event.isWithdrawn", label: "Доступ закрито", format: "boolean"},
    {name: "event.runtimeOpen", label: "Проходження відкрите", format: "boolean"},
    {name: "event.registrationOpen", label: "Реєстрація відкрита", format: "boolean"},
    {name: "event.rosterOpen", label: "Зміна команд відкрита", format: "boolean"},
    {name: "event.participation", label: "Формат участі", format: "text"},
    {name: "event.registration", label: "Режим реєстрації", format: "text"},
    {name: "event.joinPolicy", label: "Період приєднання", format: "text"},
    {name: "event.maxTeamSize", label: "Максимум у команді", format: "number"},
    {name: "event.minTeamSize", label: "Мінімум у команді", format: "number"},
    {name: "event.maxTeams", label: "Кількість команд", format: "number"},
    {name: "event.scoreboardVisibility", label: "Видимість результатів", format: "text"},
    {name: "event.participantsVisibility", label: "Видимість учасників", format: "text"},
    {name: "event.scoringProfile", label: "Система оцінювання", format: "text"},
    {name: "event.forceEventScoring", label: "Єдина система балів", format: "boolean"},
    {name: "event.approvedTeamCount", label: "Схвалених команд", format: "number"},
    {name: "event.approvedParticipantCount", label: "Схвалених учасників", format: "number"},
    {name: "event.registrationUnitCount", label: "Зареєстрованих одиниць", format: "number"},
    {name: "event.publishedChallengeCount", label: "Опублікованих завдань", format: "number"},
    {name: "event.solvedChallengeCount", label: "Розв'язаних завдань", format: "number"},
    {name: "event.solveCount", label: "Успішних розв'язань", format: "number"},
];

export const contentVariableByName = new Map(contentVariableCatalog.map(variable => [variable.name, variable]));

export function visibilityOperators(format: ContentVariableFormat) {
    if (format === "boolean" || format === "text") return [{value: "equals", label: "Дорівнює"}, {value: "not_equals", label: "Не дорівнює"}];
    if (format === "date-time") return [{value: "before", label: "До"}, {value: "after", label: "Після"}, {value: "equals", label: "Дорівнює"}, {value: "not_equals", label: "Не дорівнює"}];
    return [{value: "equals", label: "Дорівнює"}, {value: "not_equals", label: "Не дорівнює"}, {value: "greater_than", label: "Більше"}, {value: "greater_or_equal", label: "Не менше"}, {value: "less_than", label: "Менше"}, {value: "less_or_equal", label: "Не більше"}];
}

export function initialVisibilityValue(format: ContentVariableFormat): ContentValue {
    if (format === "boolean") return true;
    if (format === "number") return 0;
    if (format === "date-time") return new Date().toISOString();
    return "";
}
