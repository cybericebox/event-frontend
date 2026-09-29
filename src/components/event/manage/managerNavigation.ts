import type {ManagePage} from "@/api/manage";

export function managerLocationTitle(pathname: string, pages: ManagePage[]): string {
    if (pathname === "/manage") return "Огляд і підготовка";
    if (pathname === "/manage/settings") return "Загальне";
    if (pathname === "/manage/appearance") return "Вигляд";
    if (pathname === "/manage/participation-settings") return "Формат участі";
    if (pathname === "/manage/registration") return "Реєстрація";
    if (pathname === "/manage/results-settings") return "Налаштування результатів";
    if (pathname === "/manage/schedule") return "Публікація і час";
    if (pathname === "/manage/content/landing") return "Головна сторінка";
    if (pathname === "/manage/exercise-groups") return "Групи й порядок";
    if (pathname === "/manage/exercises") return "Завдання";
    if (pathname === "/manage/labs") return "Стенди";
    if (pathname === "/manage/scoring") return "Профіль балів";
    if (pathname === "/manage/submissions") return "Спроби розв’язання";
    if (pathname === "/manage/results") return "Таблиця результатів";
    if (pathname === "/manage/live") return "Live";
    if (pathname === "/manage/participants") return "Учасники";
    if (pathname === "/manage/teams") return "Команди";
    if (pathname === "/manage/surveys") return "Опитування";
    if (pathname === "/manage/notifications") return "Сповіщення на сайті";
    if (pathname === "/manage/email") return "Електронні листи";
    if (pathname === "/manage/mail") return "Пошта";
    if (pathname === "/manage/content/pages/new") return "Нова сторінка";
    // The editor address follows the draft slug while a draft exists.
    const page = pages.find(item => pathname === `/manage/content/pages/${item.Draft?.Slug ?? item.Slug}` || pathname === `/manage/content/pages/${item.Slug}`);
    if (page) return page.Draft?.Title ?? page.Title;
    return "Сторінки";
}
