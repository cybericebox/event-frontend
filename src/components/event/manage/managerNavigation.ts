import type {ManagePage} from "@/api/manage";
import {signalLabel} from "@/api/manageNotifications";
import {t} from "@/i18n/t";

export function managerLocationTitle(pathname: string, pages: ManagePage[]): string {
    if (pathname === "/manage") return t("manage.nav.overview");
    if (pathname === "/manage/analytics") return t("manage.nav.analyticsOverview");
    for (const section of ["participants", "tasks", "progress", "stands", "integrity", "communications", "report"]) {
        if (pathname === `/manage/analytics/${section}`) return t(`manage.nav.analytics.${section}`);
    }
    if (pathname === "/manage/settings") return t("manage.nav.settings");
    if (pathname === "/manage/appearance") return t("manage.nav.appearance");
    if (pathname === "/manage/participation-settings") return t("manage.nav.participationSettings");
    if (pathname === "/manage/registration") return t("manage.nav.registration");
    if (pathname === "/manage/results-settings") return t("manage.nav.resultsSettings");
    if (pathname === "/manage/schedule") return t("manage.nav.schedule");
    if (pathname === "/manage/content/landing") return t("manage.nav.landing");
    if (pathname === "/manage/exercise-groups") return t("manage.nav.exerciseGroups");
    if (pathname === "/manage/exercises") return t("manage.nav.exercises");
    if (pathname === "/manage/labs") return t("manage.nav.labs");
    if (pathname === "/manage/challenge-settings") return t("manage.nav.challengeSettings");
    if (pathname === "/manage/submissions") return t("manage.nav.submissions");
    if (pathname === "/manage/results") return t("manage.nav.results");
    if (pathname === "/manage/live") return t("manage.nav.live");
    if (pathname === "/manage/participants") return t("manage.nav.participants");
    if (pathname === "/manage/teams") return t("manage.nav.teams");
    if (pathname === "/manage/surveys") return t("manage.nav.surveys");
    if (pathname === "/manage/notifications") return t("manage.nav.notifications");
    if (pathname === "/manage/email") return t("manage.nav.email");
    // A template page is named after its signal.
    for (const base of ["/manage/notifications/", "/manage/email/"]) {
        if (pathname.startsWith(base)) return signalLabel(decodeURIComponent(pathname.slice(base.length))).title;
    }
    if (pathname === "/manage/mail") return t("manage.nav.mail");
    if (pathname === "/manage/mail-journal") return t("manage.nav.mailJournal");
    if (pathname === "/manage/content/pages/new") return t("manage.nav.newPage");
    // The editor address follows the draft slug while a draft exists.
    const page = pages.find(item => pathname === `/manage/content/pages/${item.Draft?.Slug ?? item.Slug}` || pathname === `/manage/content/pages/${item.Slug}`);
    if (page) return page.Draft?.Title ?? page.Title;
    return t("manage.nav.pages");
}
