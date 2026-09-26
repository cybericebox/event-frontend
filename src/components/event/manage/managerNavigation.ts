import type {ManagePage} from "@/api/manage";

export const plannedManagerPages = {
    "exercise-groups": {title: "Групи й порядок", description: "Тут можна буде об’єднувати завдання в групи та визначати їхній порядок."},
    exercises: {title: "Завдання", description: "Тут можна буде прикріплювати завдання до події та налаштовувати їх."},
    scoring: {title: "Профіль балів", description: "Тут можна буде налаштовувати бали за завдання й правила оцінювання."},
    attempts: {title: "Правила спроб", description: "Тут можна буде визначати обмеження та поведінку спроб."},
    applications: {title: "Заявки", description: "Тут можна буде переглядати й опрацьовувати заявки на участь."},
    participants: {title: "Учасники", description: "Тут можна буде керувати учасниками події."},
    teams: {title: "Команди", description: "Тут можна буде керувати командами та їхнім складом."},
    results: {title: "Таблиця результатів", description: "Тут можна буде переглядати результати учасників і команд."},
    submissions: {title: "Надсилання", description: "Тут можна буде переглядати надіслані відповіді."},
    solves: {title: "Розв’язання", description: "Тут можна буде переглядати зараховані розв’язання."},
    live: {title: "Live", description: "Тут можна буде налаштовувати окремий екран Live та його попередній перегляд."},
    "participant-form": {title: "Анкета учасника", description: "Тут можна буде налаштовувати анкету під час реєстрації учасника."},
    "team-form": {title: "Анкета команди", description: "Тут можна буде налаштовувати анкету під час створення команди."},
    surveys: {title: "Опитування", description: "Тут можна буде налаштовувати опитування та зворотний зв’язок."},
    "form-responses": {title: "Відповіді на форми", description: "Тут можна буде переглядати відповіді на анкети й опитування."},
    notifications: {title: "Сповіщення на сайті", description: "Тут можна буде налаштовувати сповіщення цієї події."},
    email: {title: "Електронні листи", description: "Тут можна буде налаштовувати листи цієї події."},
} as const;

export type PlannedManagerPage = keyof typeof plannedManagerPages;

export function plannedManagerPage(slug: string) {
    return Object.hasOwn(plannedManagerPages, slug) ? plannedManagerPages[slug as PlannedManagerPage] : null;
}

export function managerLocationTitle(pathname: string, pages: ManagePage[]): string {
    if (pathname === "/manage") return "Огляд і підготовка";
    if (pathname === "/manage/settings") return "Загальне";
    if (pathname === "/manage/appearance") return "Вигляд";
    if (pathname === "/manage/participation-settings") return "Формат події";
    if (pathname === "/manage/registration") return "Реєстрація";
    if (pathname === "/manage/results-settings") return "Налаштування результатів";
    if (pathname === "/manage/schedule") return "Публікація і час";
    if (pathname === "/manage/content/landing") return "Головна сторінка";
    if (pathname === "/manage/content/pages/new") return "Нова сторінка";
    const page = pages.find(item => pathname === `/manage/content/pages/${item.Slug}`);
    if (page) return page.Title;
    const slug = pathname.startsWith("/manage/") ? pathname.slice("/manage/".length) : "";
    return plannedManagerPage(slug)?.title ?? "Сторінки";
}
