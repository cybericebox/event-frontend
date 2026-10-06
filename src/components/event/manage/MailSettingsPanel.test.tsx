// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

vi.mock("./ManagerShell", () => ({useManager: () => ({event: {EventID: "01a0d498-32b3-7a38-8355-30cc209f56ab", Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage: true})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));

import {MailSettingsPanel} from "./MailSettingsPanel";

const party = {Name: "", Address: ""};
function settings(patch: Record<string, unknown> = {}) {
    return {
        Identity: {Sender: party, ReplyTo: party}, Inherited: {Sender: party, ReplyTo: party},
        SMTP: {Host: "smtp.uni.edu", Port: 587, TLSMode: "starttls", Username: "mailer", PasswordSet: true, UpdatedAt: null, MaxPerSecond: null, DailyQuota: null},
        PlatformConfigured: true,
        Limits: {PerSecond: 0, DailyQuota: 0, PerSecondSource: "none", DailyQuotaSource: "none", Used24h: 0},
        ...patch,
    };
}

function mockApi(initial: unknown) {
    const puts: unknown[] = [];
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PUT" && String(input).endsWith("/mail/smtp")) {
            puts.push(JSON.parse(String(init.body)));
            return new Response(JSON.stringify({Status: {Code: 0}, Data: initial}), {status: 200});
        }
        return new Response(JSON.stringify({Status: {Code: 0}, Data: initial}), {status: 200});
    }) as typeof fetch;
    return puts;
}

function renderPanel() {
    return render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><MailSettingsPanel /></QueryClientProvider>);
}

describe("Пошта заходу: ліміти SMTP", () => {
    afterEach(cleanup);

    it("shows both limit fields as plain number fields without spinners", async () => {
        mockApi(settings());
        renderPanel();
        const perSecond = await screen.findByLabelText("Максимум листів за секунду") as HTMLInputElement;
        const daily = screen.getByLabelText("Ліміт листів на добу") as HTMLInputElement;
        expect(perSecond.type).toBe("text");
        expect(daily.type).toBe("text");
        expect(perSecond.value).toBe("");
        expect(perSecond.placeholder).toBe("Без обмеження");
    });

    it("prefills the saved limits and shows the daily usage", async () => {
        mockApi(settings({
            SMTP: {Host: "smtp.uni.edu", Port: 587, TLSMode: "starttls", Username: "", PasswordSet: false, UpdatedAt: null, MaxPerSecond: 14, DailyQuota: 50000},
            Limits: {PerSecond: 14, DailyQuota: 50000, PerSecondSource: "saved", DailyQuotaSource: "saved", Used24h: 1200},
        }));
        renderPanel();
        expect((await screen.findByLabelText("Максимум листів за секунду") as HTMLInputElement).value).toBe("14");
        expect((screen.getByLabelText("Ліміт листів на добу") as HTMLInputElement).value).toBe("50000");
        expect(screen.getByTestId("mail-quota-used").textContent).toBe("За останні 24 години надіслано: 1200 з 50000.");
    });

    it("saves the typed limits, a fractional rate included", async () => {
        const puts = mockApi(settings());
        renderPanel();
        fireEvent.change(await screen.findByLabelText("Максимум листів за секунду"), {target: {value: "0,5"}});
        fireEvent.change(screen.getByLabelText("Ліміт листів на добу"), {target: {value: "50000"}});
        const smtpForm = screen.getByLabelText("Максимум листів за секунду").closest("form")!;
        fireEvent.submit(smtpForm);
        await waitFor(() => expect(puts).toHaveLength(1));
        expect(puts[0]).toMatchObject({Host: "smtp.uni.edu", MaxPerSecond: 0.5, DailyQuota: 50000});
    });

    it("blocks saving a zero limit and says why", async () => {
        const puts = mockApi(settings());
        renderPanel();
        fireEvent.change(await screen.findByLabelText("Ліміт листів на добу"), {target: {value: "0"}});
        expect(await screen.findByText("Ліміт листів на добу має бути цілим числом більше нуля.")).toBeTruthy();
        fireEvent.submit(screen.getByLabelText("Ліміт листів на добу").closest("form")!);
        expect(puts).toHaveLength(0);
    });
});

describe("Пошта заходу: збереження без миготіння", () => {
    afterEach(cleanup);

    function mockPending(mode: "ok" | "error") {
        const gate: {release?: () => void} = {};
        globalThis.fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
            if (init?.method === "PUT") {
                await new Promise<void>(resolve => { gate.release = resolve; });
                if (mode === "error") return new Response(JSON.stringify({Status: {Code: 1, Message: "fail"}}), {status: 500});
            }
            return new Response(JSON.stringify({Status: {Code: 0}, Data: settings()}), {status: 200});
        }) as typeof fetch;
        return gate;
    }

    it("shows the chosen encryption at once and keeps every control enabled during a pending save", async () => {
        const gate = mockPending("ok");
        renderPanel();
        const host = await screen.findByLabelText(/^Хост/) as HTMLInputElement;
        fireEvent.change(host, {target: {value: "smtp.other.edu"}});
        fireEvent.submit(host.closest("form")!);
        await waitFor(() => expect(gate.release).toBeTruthy());
        const encryption = screen.getByRole("button", {name: "Шифрування"});
        expect((encryption as HTMLButtonElement).disabled).toBe(false);
        expect(host.disabled).toBe(false);
        expect((screen.getByLabelText(/^Користувач/) as HTMLInputElement).disabled).toBe(false);
        fireEvent.pointerDown(encryption, {button: 0, ctrlKey: false});
        fireEvent.click(await screen.findByRole("menuitemradio", {name: "TLS (465)"}));
        expect((screen.getByLabelText(/^Порт/) as HTMLInputElement).value).toBe("465");
        expect(screen.getByRole("button", {name: "Шифрування"}).textContent).toContain("TLS (465)");
        gate.release?.();
    });

    it("keeps the typed values when a save fails", async () => {
        const gate = mockPending("error");
        renderPanel();
        const host = await screen.findByLabelText(/^Хост/) as HTMLInputElement;
        fireEvent.change(host, {target: {value: "smtp.other.edu"}});
        fireEvent.submit(host.closest("form")!);
        await waitFor(() => expect(gate.release).toBeTruthy());
        gate.release?.();
        await waitFor(() => expect((screen.getAllByRole("button", {name: "Зберегти"}).at(-1) as HTMLButtonElement).disabled).toBe(false));
        expect(host.value).toBe("smtp.other.edu");
    });
});
