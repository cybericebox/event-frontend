// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
vi.mock("@/utils/origins", async original => ({...(await original() as object), adminOrigin: "https://admin.example.org"}));
import {ManagerSidebar} from "./ManagerSidebar";

afterEach(() => {cleanup(); window.sessionStorage.clear(); window.history.replaceState(null, "", "/");});

const event = {
    EventID: "01900000-0000-7000-8000-000000000001", Tag: "test", Name: "Test",
    StartTime: "2026-09-28T00:00:00Z", FinishTime: null, Status: 2,
    Participation: 0, Registration: 1, CanViewResults: false, CanViewParticipants: false,
    PreviewDescription: "", PreviewPicture: "", LogoURL: "", FaviconURL: "",
    ShowStartCountdown: true, ShowFinishCountdown: true, FinishCountdownMinutes: 10,
    Theme: {Brand: "#211A52", Accent: "", AccentLight: "#211A52", AccentDark: "#E6E6EE", AccentLive: "#FFFFFF", Version: 1},
} satisfies PublicEventInfo;

function renderSidebar(participation: 0 | 1, infrastructure = false) {
    render(<ManagerSidebar event={{...event, Participation: participation}} pathname="/manage/participants" pages={[]} pagesError={false} canManage infrastructureAllowed={infrastructure} onRetryPages={vi.fn()} onNavigate={vi.fn()} />);
    // The group of the current page (/manage/participants) opens on its own.
    expect(screen.getByRole("button", {name: "Участь"}).getAttribute("aria-expanded")).toBe("true");
}

describe("participation navigation", () => {
    it("places participation and challenges immediately after event settings", () => {
        renderSidebar(0);
        const headings = screen.getAllByRole("button", {name: /^(Захід|Участь|Завдання|Сторінки)$/});
        expect(headings.map(heading => heading.textContent?.trim())).toEqual(["Захід", "Участь", "Завдання", "Сторінки"]);
    });

    it("keeps requests inside participants and hides teams for an individual event", () => {
        renderSidebar(0);
        expect(screen.getByRole("link", {name: "Реєстрація"})).toBeTruthy();
        expect(screen.getByRole("link", {name: "Учасники"})).toBeTruthy();
        expect(screen.queryByRole("link", {name: "Додаткові поля"})).toBeNull();
        expect(screen.queryByRole("link", {name: "Заявки"})).toBeNull();
        expect(screen.queryByRole("link", {name: "Команди"})).toBeNull();
        expect(screen.queryByRole("button", {name: "Форми"})).toBeNull();
    });

    it("shows teams for a team event", () => {
        renderSidebar(1);
        expect(screen.getByRole("link", {name: "Команди"})).toBeTruthy();
    });

    it("shows stands only when infrastructure tasks are allowed", () => {
        renderSidebar(1);
        fireEvent.click(screen.getByRole("button", {name: "Завдання"}));
        expect(screen.queryByRole("link", {name: "Стенди"})).toBeNull();
        cleanup();
        renderSidebar(1, true);
        fireEvent.click(screen.getByRole("button", {name: "Завдання"}));
        expect(screen.getByRole("link", {name: "Стенди"})).toBeTruthy();
    });

    it("orders the challenges group: settings, groups, tasks, stands, journal", () => {
        renderSidebar(1, true);
        fireEvent.click(screen.getByRole("button", {name: "Завдання"}));
        const links = Array.from(document.getElementById("event-manage-group-challenges")!.querySelectorAll("a"));
        expect(links.map(link => [link.textContent?.trim(), link.getAttribute("href")])).toEqual([
            ["Налаштування", "/manage/challenge-settings"],
            ["Групи й порядок", "/manage/exercise-groups"],
            ["Завдання", "/manage/exercises"],
            ["Стенди", "/manage/labs"],
            ["Журнал спроб", "/manage/submissions"],
        ]);
    });

    it("lists the settings page and the sending journal under notifications", () => {
        renderSidebar(0);
        fireEvent.click(screen.getByRole("button", {name: "Сповіщення"}));
        expect(screen.getByRole("link", {name: "Налаштування"}).getAttribute("href")).toBe("/manage/mail");
        expect(screen.getByRole("link", {name: "Журнал надсилання"}).getAttribute("href")).toBe("/manage/mail-journal");
    });

    describe("analytics group", () => {
        function renderAnalytics(analytics: {Sections: boolean; Sensitive: boolean} | undefined, infrastructure = false) {
            render(<ManagerSidebar event={{...event, Participation: 1}} pathname="/manage/analytics" pages={[]} pagesError={false} canManage infrastructureAllowed={infrastructure} analytics={analytics} onRetryPages={vi.fn()} onNavigate={vi.fn()} />);
            const heading = screen.queryByRole("button", {name: "Аналітика"});
            if (heading) fireEvent.click(heading);
        }
        const items = () => Array.from(document.getElementById("event-manage-group-analytics")!.querySelectorAll("a")).map(link => [link.textContent?.trim(), link.getAttribute("href")]);

        it("is hidden until the viewer is known to have analytics access", () => {
            renderAnalytics(undefined);
            expect(screen.queryByRole("button", {name: "Аналітика"})).toBeNull();
            cleanup();
            renderAnalytics({Sections: false, Sensitive: false});
            expect(screen.queryByRole("button", {name: "Аналітика"})).toBeNull();
        });

        it("lists the sections in order and leaves out stands and integrity without the right", () => {
            renderAnalytics({Sections: true, Sensitive: false});
            expect(items()).toEqual([
                ["Огляд", "/manage/analytics"],
                ["Учасники", "/manage/analytics/participants"],
                ["Завдання", "/manage/analytics/tasks"],
                ["Прогрес", "/manage/analytics/progress"],
                ["Комунікації", "/manage/analytics/communications"],
                ["Звіт", "/manage/analytics/report"],
            ]);
        });

        it("adds stands for infrastructure events and integrity for the sensitive level", () => {
            renderAnalytics({Sections: true, Sensitive: true}, true);
            expect(items().map(([label]) => label)).toEqual(["Огляд", "Учасники", "Завдання", "Прогрес", "Стенди", "Доброчесність", "Комунікації", "Звіт"]);
        });
    });

    it("orders the notifications group in three blocks split by dividers", () => {
        renderSidebar(0);
        fireEvent.click(screen.getByRole("button", {name: "Сповіщення"}));
        const group = document.getElementById("event-manage-group-notifications")!;
        const order = Array.from(group.children).map(node => node.tagName === "HR" ? "|" : node.textContent?.trim());
        expect(order).toEqual(["Розсилка", "Банери", "|", "Шаблони на сайті", "Шаблони листів", "Налаштування", "|", "Журнал надсилання"]);
        expect(group.querySelector('a[href="/manage/mail"]')).toBeTruthy();
    });

    it("gives every top-level row and every sub-item an icon, in one row style", () => {
        renderSidebar(1, true);
        const nav = screen.getByRole("navigation", {name: "Розділи керування"});
        const rows = Array.from(nav.querySelectorAll<HTMLElement>(":scope > a, :scope > section > button"));
        expect(rows.length).toBeGreaterThan(5);
        for (const row of rows) {
            expect(row.classList.contains("ib-admin-side__item")).toBe(true);
            expect(row.querySelector("svg")).toBeTruthy();
        }
        for (const heading of Array.from(nav.querySelectorAll("button[aria-expanded=false]"))) fireEvent.click(heading);
        for (const link of Array.from(nav.querySelectorAll("section a.ib-admin-side__item"))) expect(link.querySelector("svg"), link.textContent ?? "").toBeTruthy();
    });

    it("does not indent sub-items", () => {
        renderSidebar(0);
        const items = document.getElementById("event-manage-group-participation")!;
        expect(items.className).toBe("event-manage-sidebar__items");
        expect(items.querySelector("a")!.className).toBe("ib-admin-side__item");
    });

    describe("return to administration", () => {
        const back = () => screen.queryByRole("link", {name: "Повернутися до адміністрування"});
        it("is hidden without an origin", () => {
            renderSidebar(0);
            expect(back()).toBeNull();
        });
        it("shows the validated admin origin and keeps it for the session", () => {
            window.history.replaceState(null, "", `/manage?from=${encodeURIComponent("https://admin.example.org/events")}`);
            renderSidebar(0);
            expect(back()!.getAttribute("href")).toBe("https://admin.example.org/events");
            cleanup();
            window.history.replaceState(null, "", "/manage/labs");
            renderSidebar(0);
            expect(back()!.getAttribute("href")).toBe("https://admin.example.org/events");
        });
        it("ignores a foreign origin", () => {
            window.history.replaceState(null, "", `/manage?from=${encodeURIComponent("https://evil.example.com/events")}`);
            renderSidebar(0);
            expect(back()).toBeNull();
        });
    });
});
