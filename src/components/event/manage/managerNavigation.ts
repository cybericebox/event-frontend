import type {ManagePage} from "@/api/manage";

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
    if (pathname === "/manage/live") return "Live";
    if (pathname === "/manage/applications") return "Заявки";
    if (pathname === "/manage/participants") return "Учасники";
    if (pathname === "/manage/teams") return "Команди";
    if (pathname === "/manage/participant-form") return "Анкета учасника";
    if (pathname === "/manage/surveys") return "Опитування";
    if (pathname === "/manage/notifications") return "Сповіщення на сайті";
    if (pathname === "/manage/email") return "Електронні листи";
    if (pathname === "/manage/form-responses") return "Відповіді на форми";
    if (pathname === "/manage/content/pages/new") return "Нова сторінка";
    const page = pages.find(item => pathname === `/manage/content/pages/${item.Slug}`);
    if (page) return page.Title;
    return "Сторінки";
}
