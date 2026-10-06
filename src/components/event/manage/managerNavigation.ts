import type {ManagePage} from "@/api/manage";
import {signalLabel} from "@/api/manageNotifications";
import {t} from "@/i18n/t";

export type ManageCrumb = {label: string; href?: string};

// Section of the sidebar group each page lives in; a top-level page has none.
const sections: {group: () => string; pages: string[]}[] = [
    {group: () => t("manage.nav.group.event"), pages: ["/manage/settings", "/manage/appearance", "/manage/participation-settings", "/manage/schedule"]},
    {group: () => t("manage.nav.group.participation"), pages: ["/manage/registration", "/manage/participants", "/manage/teams"]},
    {group: () => t("manage.nav.group.challenges"), pages: ["/manage/challenge-settings", "/manage/exercise-groups", "/manage/exercises", "/manage/labs", "/manage/resources", "/manage/submissions"]},
    {group: () => t("manage.nav.group.results"), pages: ["/manage/results-settings", "/manage/results", "/manage/live"]},
    {group: () => t("manage.nav.group.notifications"), pages: ["/manage/banners", "/manage/notifications", "/manage/email", "/manage/mail", "/manage/mail-journal"]},
];

const pageNames: Record<string, () => string> = {
    "/manage/settings": () => t("manage.nav.settings"),
    "/manage/appearance": () => t("manage.nav.appearance"),
    "/manage/participation-settings": () => t("manage.nav.participationSettings"),
    "/manage/registration": () => t("manage.nav.registration"),
    "/manage/results-settings": () => t("manage.nav.resultsSettings"),
    "/manage/schedule": () => t("manage.nav.schedule"),
    "/manage/exercise-groups": () => t("manage.nav.exerciseGroups"),
    "/manage/exercises": () => t("manage.nav.exercises"),
    "/manage/labs": () => t("manage.nav.labs"),
    "/manage/resources": () => t("manage.nav.resources"),
    "/manage/challenge-settings": () => t("manage.nav.challengeSettings"),
    "/manage/submissions": () => t("manage.nav.submissions"),
    "/manage/results": () => t("manage.nav.results"),
    "/manage/live": () => t("manage.nav.live"),
    "/manage/participants": () => t("manage.nav.participants"),
    "/manage/teams": () => t("manage.nav.teams"),
    "/manage/notifications": () => t("manage.nav.notifications"),
    "/manage/email": () => t("manage.nav.email"),
    "/manage/banners": () => t("manage.nav.banners"),
    "/manage/mail": () => t("manage.nav.mail"),
    "/manage/mail-journal": () => t("manage.nav.mailJournal"),
};

/**
 * The top bar trail of a /manage address: «Section › Page» (a nested page adds its parent page as a link).
 * A top-level page is a single crumb; an unknown address is null, so the bar never names a wrong section.
 */
export function managerCrumbs(pathname: string, pages: ManagePage[]): ManageCrumb[] | null {
    const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
    if (path === "/manage") return [{label: t("manage.nav.overview")}];
    if (path === "/manage/analytics") return [{label: t("manage.nav.group.analytics")}, {label: t("manage.nav.analyticsOverview")}];
    for (const section of ["participants", "tasks", "progress", "stands", "usage", "integrity", "communications", "report"]) {
        if (path === `/manage/analytics/${section}`) return [{label: t("manage.nav.group.analytics")}, {label: t(`manage.nav.analytics.${section}`)}];
    }
    const pageName = pageNames[path];
    const group = sections.find(item => item.pages.includes(path));
    if (pageName && group) return [{label: group.group()}, {label: pageName()}];
    // A template page is named after its signal and sits under its list.
    for (const [base, list] of [["/manage/notifications/", "/manage/notifications"], ["/manage/email/", "/manage/email"]]) {
        if (path.startsWith(base) && path.length > base.length) {
            return [{label: t("manage.nav.group.notifications")}, {label: pageNames[list](), href: list}, {label: signalLabel(decodeURIComponent(path.slice(base.length))).title}];
        }
    }
    const notifications = t("manage.nav.group.notifications");
    if (path === "/manage/broadcasts/new") return [{label: notifications}, {label: t("manage.nav.broadcasts"), href: "/manage/broadcasts"}, {label: t("manage.broadcasts.new")}];
    if (path === "/manage/broadcasts" || path.startsWith("/manage/broadcasts/")) return [{label: notifications}, {label: t("manage.nav.broadcasts")}];
    const pagesGroup = t("manage.nav.pages");
    if (path === "/manage/content/landing") return [{label: pagesGroup}, {label: t("manage.nav.landing")}];
    if (path === "/manage/content/pages/new") return [{label: pagesGroup}, {label: t("manage.nav.newPage")}];
    // The editor address follows the draft slug while a draft exists.
    const page = pages.find(item => path === `/manage/content/pages/${item.Draft?.Slug ?? item.Slug}` || path === `/manage/content/pages/${item.Slug}`);
    if (page) return [{label: pagesGroup}, {label: page.Draft?.Title ?? page.Title}];
    return null;
}

// The open page's own name, for the tab title.
export function managerLocationTitle(pathname: string, pages: ManagePage[]): string | null {
    const crumbs = managerCrumbs(pathname, pages);
    return crumbs ? crumbs[crumbs.length - 1].label : null;
}
