import type {ManagePage} from "@/api/manage";

export const plannedManagerPages = {
    attempts: {title: "Правила спроб", description: "Тут можна буде визначати обмеження та поведінку спроб."},
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
    if (pathname === "/manage/exercise-groups") return "Групи й порядок";
    if (pathname === "/manage/exercises") return "Завдання";
    if (pathname === "/manage/scoring") return "Профіль балів";
    if (pathname === "/manage/submissions") return "Надсилання";
    if (pathname === "/manage/solves") return "Розв’язання";
    if (pathname === "/manage/results") return "Таблиця результатів";
    if (pathname === "/manage/applications") return "Заявки";
    if (pathname === "/manage/participants") return "Учасники";
    if (pathname === "/manage/teams") return "Команди";
    if (pathname === "/manage/content/pages/new") return "Нова сторінка";
    const page = pages.find(item => pathname === `/manage/content/pages/${item.Slug}`);
    if (page) return page.Title;
    const slug = pathname.startsWith("/manage/") ? pathname.slice("/manage/".length) : "";
    return plannedManagerPage(slug)?.title ?? "Сторінки";
}
