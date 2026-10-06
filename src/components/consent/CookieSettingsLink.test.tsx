// @vitest-environment jsdom
// «Налаштування файлів cookie» is always in the event footer (no GA needed): a link to the
// main-site cookie policy that opens the consent panel instead of navigating.
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {CONSENT_OPEN_EVENT} from "@/utils/consent";
import {CookieSettingsLink} from "./CookieSettingsLink";
import {Analytics} from "./Analytics";

// next/script stands in as a marker element carrying the id and src
vi.mock("next/script", () => ({default: (p: {id: string; src?: string}) => <i data-script={p.id} data-src={p.src} />}));

afterEach(() => cleanup());

describe("cookie settings entry", () => {
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
        for (const f of ["GuestShell.tsx", "ParticipantShell.tsx"]) expect(read(f)).toContain("<EventFooter eventName={event.Name} />");
    });
});
