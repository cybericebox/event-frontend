// @vitest-environment jsdom
/**
 * The "home" links of the platform error pages. With the main site set they lead to it; without it a link that would lead to the page
 * itself (an unknown or hidden event: `/` is the same screen) is hidden, so nothing visible leads to itself or to nothing.
 * Visibility is decided by the real selectors of src/styles/cfg.css against the setting attribute of <html>.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import fs from "node:fs";
import path from "node:path";

vi.mock("@/api/clientAuth", () => ({getCurrentUser: () => Promise.resolve({ID: "u1", Email: "a@b.test"})}));
vi.mock("@/api/authAPI", () => ({signOut: vi.fn()}));
vi.mock("@/utils/signInRedirect", () => ({signInRedirectTarget: () => "#signed-out"}));

import {ErrorPage} from "./ErrorPage";
import {NoAccessScreen} from "./NoAccessScreen";

const css = fs.readFileSync(path.resolve(import.meta.dirname, "../../styles/cfg.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const hiding = [...css.matchAll(/([^{}]+)\{\s*display:\s*none\s*!important;\s*\}/g)].flatMap(m => m[1].split(/,\s*(?![^(]*\))/).map(s => s.trim()).filter(Boolean));
const hidden = (el: Element) => hiding.some(selector => el.matches(selector));

const MAIN = "https://example.test";

function setMainSite(value: string | null) {
    if (value === null) {
        vi.stubEnv("NEXT_PUBLIC_MAIN_SITE_URL", "");
        document.documentElement.removeAttribute("data-cfg-main-site-url");
    } else {
        vi.stubEnv("NEXT_PUBLIC_MAIN_SITE_URL", value);
        document.documentElement.setAttribute("data-cfg-main-site-url", value);
    }
}

beforeEach(() => document.documentElement.removeAttribute("data-cfg-main-site-url"));
afterEach(() => {cleanup(); vi.unstubAllEnvs(); document.documentElement.removeAttribute("data-cfg-main-site-url");});

const visibleLinks = (root: ParentNode) => [...root.querySelectorAll("a")].filter(a => !hidden(a));
const visibleBrand = (root: ParentNode) => [...root.querySelectorAll(".ib-error__brand")].filter(el => !hidden(el));

function renderPage(props: Partial<React.ComponentProps<typeof ErrorPage>> = {}) {
    const client = new QueryClient();
    return render(<QueryClientProvider client={client}><ErrorPage mode="page" code={404} title="Не знайдено" platformBrand {...props} /></QueryClientProvider>).container;
}

describe("platform-branded error page", () => {
    it("with the main site: the brand and «На головну» lead to it, the plain brand twin is hidden", () => {
        setMainSite(MAIN);
        const footer = renderPage().querySelector("footer")!;
        const brands = visibleBrand(footer);
        expect(brands).toHaveLength(1);
        expect(brands[0].tagName).toBe("A");
        expect(brands[0].getAttribute("href")).toBe(MAIN);
        const home = screen.getByRole("link", {name: "На головну"});
        expect(hidden(home)).toBe(false);
        expect(home.getAttribute("href")).toBe(MAIN);
    });

    it("without the main site: the brand is plain text and «На головну» is hidden, no visible link leads to `/` or nowhere", () => {
        setMainSite(null);
        const footer = renderPage().querySelector("footer")!;
        const brands = visibleBrand(footer);
        expect(brands).toHaveLength(1);
        expect(brands[0].tagName).toBe("SPAN");
        expect(brands[0].textContent).toMatch(/Cyber.*ICE.*Box/);
        for (const link of visibleLinks(footer)) {
            const href = link.getAttribute("href");
            expect(href, link.outerHTML).toBeTruthy();
            expect(href).not.toBe("/");
        }
        expect(visibleLinks(footer).map(a => a.textContent)).not.toContain("На головну");
    });

    it("an explicit homeHref (a page where `/` is another page) stays a plain link in both states", () => {
        for (const value of [MAIN, null]) {
            cleanup();
            setMainSite(value);
            const footer = renderPage({homeHref: "/"}).querySelector("footer")!;
            const home = visibleLinks(footer).filter(a => a.textContent === "На головну");
            expect(home.map(a => a.getAttribute("href"))).toEqual(["/"]);
            expect(visibleBrand(footer).map(a => a.getAttribute("href"))).toEqual(["/"]);
        }
    });
});

describe("NoAccessScreen", () => {
    function renderNoAccess(homeHref?: string) {
        const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
        return render(<QueryClientProvider client={client}><NoAccessScreen homeHref={homeHref} /></QueryClientProvider>).container;
    }

    it("default home: both «На головну» links lead to the main site when it is set", async () => {
        setMainSite(MAIN);
        const root = renderNoAccess();
        await screen.findByRole("heading", {name: "Немає доступу"});
        const links = [...root.querySelectorAll("a")].filter(a => a.textContent === "На головну");
        expect(links).toHaveLength(2);
        for (const link of links) {
            expect(hidden(link)).toBe(false);
            expect(link.getAttribute("href")).toBe(MAIN);
        }
    });

    it("default home without the main site: neither «На головну» is visible, nothing visible leads to itself", async () => {
        setMainSite(null);
        const root = renderNoAccess();
        await screen.findByRole("heading", {name: "Немає доступу"});
        expect(visibleLinks(root).filter(a => a.textContent === "На головну")).toEqual([]);
        expect(visibleLinks(root).filter(a => a.getAttribute("href") === "/")).toEqual([]);
    });

    it.each([MAIN, null])("homeHref=\"/\" (live, live bootstrap, manager shell) is unchanged with main site %s", async value => {
        setMainSite(value);
        const root = renderNoAccess("/");
        await screen.findByRole("heading", {name: "Немає доступу"});
        const links = visibleLinks(root).filter(a => a.textContent === "На головну");
        expect(links.map(a => a.getAttribute("href"))).toEqual(["/", "/"]);
    });
});
