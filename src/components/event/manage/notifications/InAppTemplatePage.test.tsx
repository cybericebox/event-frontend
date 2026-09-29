// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {EVENT_ID, FINISHED, fakeServer, inAppTemplate, subscription, uuid} from "./fixtures/server";

const router = vi.hoisted(() => ({replace: vi.fn()}));
vi.mock("next/navigation", () => ({useRouter: () => router}));
vi.mock("../ManagerShell", () => ({useManager: () => ({event: {EventID: EVENT_ID, Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage: true})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));
vi.mock("react-hot-toast", () => ({toast: {success: vi.fn(), error: vi.fn()}}));

import {InAppTemplatePage} from "./InAppTemplatePage";

const subs = [subscription(FINISHED, "in_app")];
function renderPage() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><InAppTemplatePage signal={FINISHED} /></QueryClientProvider>);
}

describe("Сторінка сповіщення на сайті", () => {
    afterEach(() => { cleanup(); router.replace.mockClear(); vi.restoreAllMocks(); });

    it("shows the platform template read-only next to the preview", async () => {
        fakeServer("in_app", subs, [inAppTemplate(1)]);
        const {container} = renderPage();
        await screen.findByText("Спливаюче повідомлення");
        expect(container.querySelector(".event-notification-popin strong")?.textContent).toBe("CTF 2027");
        expect(screen.getByRole("textbox", {name: "Заголовок", hidden: true}).closest("[inert]")).not.toBeNull();
        expect(screen.getByRole("button", {name: "Налаштувати для заходу"})).toBeTruthy();
    });

    it("copies the template for the event and moves to the copy", async () => {
        const calls = fakeServer("in_app", subs, [inAppTemplate(1)]);
        renderPage();
        fireEvent.click(await screen.findByRole("button", {name: "Налаштувати для заходу"}));
        await waitFor(() => expect(router.replace).toHaveBeenCalledWith(`/manage/notifications/${FINISHED}?id=${uuid(900)}`));
        expect(calls.some(call => call.method === "POST" && call.path.endsWith(`${uuid(1)}/customize`))).toBe(true);
    });

    it("edits the draft with every field labelled and validates the title", async () => {
        fakeServer("in_app", subs, [inAppTemplate(1), inAppTemplate(2, {Source: "event", Status: "draft"})]);
        renderPage();
        const title = await screen.findByRole("textbox", {name: "Заголовок"});
        for (const name of ["Про поле «Заголовок»", "Про поле «Текст»", "Про поле «Посилання»", /^Про поле «.*вигляд/i, "Про поле «Час показу спливаючого повідомлення, секунди»", "Про поле «Кнопка»"]) expect(screen.getByRole("button", {name})).toBeTruthy();
        expect(screen.getByRole("button", {name: "Повернути стандартний"})).toBeTruthy();
        title.textContent = "";
        fireEvent.input(title);
        expect(screen.getByRole("alert").textContent).toBe("Заповніть заголовок.");
        expect((screen.getByRole("button", {name: "Зберегти чернетку"}) as HTMLButtonElement).disabled).toBe(true);
    });
});
