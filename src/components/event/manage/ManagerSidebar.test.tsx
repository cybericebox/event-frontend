// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import type {PublicEventInfo} from "@/api/publicEventInfo";
import {ManagerSidebar} from "./ManagerSidebar";

afterEach(cleanup);

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
    fireEvent.click(screen.getByRole("button", {name: "Участь"}));
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
    });
        expect(screen.getByRole("link", {name: "Журнал надсилання"}).getAttribute("href")).toBe("/manage/mail-journal");
});
