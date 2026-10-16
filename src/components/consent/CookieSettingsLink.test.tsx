// @vitest-environment jsdom
// «Налаштування файлів cookie» is always in the event footer (no GA needed): a link to the
// main-site cookie policy that opens the consent panel instead of navigating.
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {CONSENT_OPEN_EVENT} from "@/utils/consent";
import {CookieSettingsLink} from "./CookieSettingsLink";
import {Analytics} from "./Analytics";
import {ManualDraftProvider, useSessionDraftState} from "@/components/event/manage/manualDraft";
import {t} from "@/i18n/t";

// next/script stands in as a marker element carrying the id and src
vi.mock("next/script", () => ({default: (p: {id: string; src?: string}) => <i data-script={p.id} data-src={p.src} />}));
vi.mock("next/navigation", () => ({usePathname: () => "/manage/settings", useRouter: () => ({push: vi.fn(), replace: vi.fn()})}));
HTMLDialogElement.prototype.showModal ??= function () {this.setAttribute("open", "");};
HTMLDialogElement.prototype.close ??= function () {this.removeAttribute("open");};

afterEach(() => cleanup());

describe("cookie settings entry", () => {
    it("opens consent settings without discarding a manual draft", () => {
        sessionStorage.clear();
        function Form() {
            const [name, setName] = useSessionDraftState<string | null>("name", null);
            return <input aria-label="name" value={name ?? ""} onChange={event => setName(event.target.value)} />;
        }
        const opened = vi.fn();
        window.addEventListener(CONSENT_OPEN_EVENT, opened);
        render(<ManualDraftProvider userID="user-a" eventID="event-a"><Form /><CookieSettingsLink /></ManualDraftProvider>);
        fireEvent.change(screen.getByLabelText("name"), {target: {value: "unsaved"}});
        fireEvent.click(screen.getByRole("link", {name: t("consent.settings")}));
        expect(opened).toHaveBeenCalledTimes(1);
        expect(screen.queryByText(t("manage.unsaved.title"))).toBeNull();
        expect(screen.getByLabelText("name")).toHaveProperty("value", "unsaved");
        window.removeEventListener(CONSENT_OPEN_EVENT, opened);
        sessionStorage.clear();
    });

    it("is a link to the cookie policy that opens the panel without navigating", () => {
        const opened = vi.fn();
        window.addEventListener(CONSENT_OPEN_EVENT, opened);
        render(<CookieSettingsLink />);
        const link = screen.getByRole("link", {name: "Налаштування файлів cookie"});
        expect(link.getAttribute("href")).toMatch(/\/cookies$/);
        expect(fireEvent.click(link)).toBe(false);
        expect(opened).toHaveBeenCalledTimes(1);
        window.removeEventListener(CONSENT_OPEN_EVENT, opened);
    });

    it("without GA the consent panel is mounted but no gtag script", () => {
        const {container} = render(<Analytics />);
        expect(container.querySelector("[data-script]")).toBeNull();
        cleanup();
        const withGa = render(<Analytics gaId="G-TEST" />);
        expect(withGa.container.querySelector('[data-src*="googletagmanager"]')).not.toBeNull();
    });

    it("the shared event footer renders it unconditionally, and both shells use it", async () => {
        const {readFileSync} = await import("node:fs");
        const path = await import("node:path");
        const read = (f: string) => readFileSync(path.join(process.cwd(), "src/components/event", f), "utf8");
        expect(read("EventFooter.tsx")).toContain("<CookieSettingsLink />");
        expect(read("EventFooter.tsx")).not.toMatch(/GOOGLE_ANALYTICS_ID/);
        for (const f of ["GuestShell.tsx", "ParticipantShell.tsx"]) expect(read(f)).toMatch(/<EventFooter\b[^>]*\beventName=\{event\.Name\}[^>]*\/>/);
    });
});
