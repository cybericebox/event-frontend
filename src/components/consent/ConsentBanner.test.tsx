// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {ConsentBanner} from "./ConsentBanner";
import {openConsentSettings} from "@/utils/consent";

// jsdom (localhost) rejects a parent-domain cookie, so these tests use a host-only one.
beforeEach(() => vi.stubEnv("NEXT_PUBLIC_COOKIE_DOMAIN", ""));

afterEach(() => {
    vi.unstubAllEnvs();
    cleanup();
    document.cookie = "cib_consent=; path=/; max-age=0";
});

const click = (name: string) => fireEvent.click(screen.getByRole("button", {name}));

describe("ConsentBanner", () => {
    it("banner: «Прийняти всі» grants analytics and hides", () => {
        render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />);
        expect(screen.getByRole("region")).toBeTruthy();
        click("Прийняти всі");
        expect(screen.queryByRole("region")).toBeNull();
        expect(document.cookie).toContain("cib_consent=analytics:granted");
    });

    it("customize → save choice with analytics off (the default)", () => {
        render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />);
        click("Налаштувати");
        const dialog = screen.getByRole("dialog");
        expect(document.activeElement).toBe(dialog);
        const [necessary, analytics] = screen.getAllByRole("switch") as HTMLInputElement[];
        expect(necessary.checked && necessary.disabled).toBe(true);
        expect(analytics.checked).toBe(false);
        click("Зберегти вибір");
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(document.cookie).toContain("cib_consent=analytics:denied");
    });

    it("customize → save choice with analytics on", () => {
        render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />);
        click("Налаштувати");
        fireEvent.click(screen.getAllByRole("switch")[1]);
        click("Зберегти вибір");
        expect(document.cookie).toContain("cib_consent=analytics:granted");
    });

    it("the panel has only «Зберегти вибір» and «Прийняти всі»; saving with analytics off drops _ga", () => {
        document.cookie = "_ga=GA1.1.1; path=/";
        render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />);
        click("Налаштувати");
        expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual(["Зберегти вибір", "Прийняти всі"]);
        expect(screen.queryByRole("button", {name: "Відхилити всі"})).toBeNull();
        click("Зберегти вибір");
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(document.cookie).toContain("cib_consent=analytics:denied");
        expect(document.cookie).not.toMatch(/(^|; )_ga=/);
    });

    it("Esc never consents: on the panel it steps back to the banner", () => {
        render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />);
        click("Налаштувати");
        fireEvent.keyDown(screen.getByRole("dialog"), {key: "Escape"});
        expect(screen.getByRole("region")).toBeTruthy();
        expect(document.cookie).not.toContain("cib_consent");
    });

    it("stays hidden once a choice exists; settings open the panel, Esc closes it unchanged", () => {
        document.cookie = "cib_consent=analytics:granted; path=/";
        render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />);
        expect(screen.queryByRole("region")).toBeNull();
        act(() => openConsentSettings());
        const dialog = screen.getByRole("dialog");
        expect(document.activeElement).toBe(dialog);
        expect((screen.getAllByRole("switch")[1] as HTMLInputElement).checked).toBe(true);
        fireEvent.keyDown(dialog, {key: "Escape"});
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(document.cookie).toContain("cib_consent=analytics:granted");
    });

    it("never shows when GA is not configured", () => {
        render(<ConsentBanner gaId="" policyHref="/cookies" />);
        expect(screen.queryByRole("region")).toBeNull();
    });

    it("the policy link opens a new tab and keeps the panel and its unsaved toggles", () => {
        render(<ConsentBanner gaId="G-TEST" policyHref="/cookies"/>);
        click("Налаштувати");
        fireEvent.click(screen.getAllByRole("switch")[1]);
        const link = screen.getByRole("link", {name: "Політика файлів cookie (відкриється в новій вкладці)"});
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toContain("noopener");
        fireEvent.click(link);
        expect(screen.getByRole("dialog")).toBeTruthy();
        expect((screen.getAllByRole("switch")[1] as HTMLInputElement).checked).toBe(true);
        expect(document.cookie).not.toContain("cib_consent");
    });
});

describe("ConsentBanner without GA", () => {
    it("never asks on its own but opens the panel on request", () => {
        render(<ConsentBanner policyHref="/cookies" />);
        expect(screen.queryByRole("region")).toBeNull();
        act(() => openConsentSettings());
        expect(screen.getByRole("dialog")).toBeTruthy();
    });
});
