import {describe, expect, it, vi} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

import uk from "../../messages/uk.json";
import en from "../../messages/en.json";
import ErrorPage from "./error";
import GlobalError from "./global-error";
import {EventBrandProvider} from "@/components/event/EventBrandLogo";
import {AppShell} from "@/components/event/AppShell";

// next/font needs the Next compiler
vi.mock("geist/font/sans", () => ({GeistSans: {variable: "font-sans"}}));
vi.mock("geist/font/mono", () => ({GeistMono: {variable: "font-mono"}}));
vi.mock("next/navigation", () => ({usePathname: () => "/", useRouter: () => ({refresh: () => {}})}));

const noop = () => {};
const error = Object.assign(new Error("secret stack detail"), {digest: "d1"});

describe("error pages", () => {
    it("error boundary renders the i18n texts, both actions and no error details", () => {
        const html = renderToStaticMarkup(<ErrorPage error={error} retry={noop} />);
        expect(html).toContain("Не вдалося завантажити сторінку");
        expect(html).toContain(uk["error.page.body"]);
        expect(html).toContain(">Спробувати ще раз<");
        expect(html).toContain(">Назад<");
        expect(html).not.toContain("secret stack detail");
    });

    it("error boundary is the block inside the shell: code, no footer, no brand", () => {
        const html = renderToStaticMarkup(<EventBrandProvider logoURL="https://cdn.example/logo.png" name="Кубок CTF"><ErrorPage error={error} retry={noop} /></EventBrandProvider>);
        expect(html).toContain("ib-error--block");
        expect(html).toContain(">500<");
        expect(html).not.toContain("ib-error__footer");
        expect(html).not.toContain("logo.png");
        expect(html).toContain("ib-btn ib-btn--primary");
    });

    it("global error renders its own document with the platform crest", () => {
        const html = renderToStaticMarkup(<GlobalError error={error} retry={noop} />);
        expect(html).toMatch(/^<html lang="uk"/);
        expect(html).toContain("<title>Не вдалося завантажити сторінку</title>");
        expect(html).toContain(">Спробувати ще раз<");
        expect(html).toContain("ib-error--page");
        expect(html).toContain("ib-error__footer");
        expect(html).toContain("crest-128");
        expect(html).toContain('href="mailto:')
        expect(html).not.toContain("secret stack detail");
    });

    it("an unavailable event (server fetch failed) keeps the shell frame under the outage modal", () => {
        const client = new QueryClient();
        const html = renderToStaticMarkup(<QueryClientProvider client={client}><AppShell event={null} unavailable><p>page</p></AppShell></QueryClientProvider>);
        expect(html).toContain("ib-navbar");
        expect(html).toContain("crest-128");
        expect(html).toContain('role="alertdialog"');
        expect(html).toContain(uk["shell.unavailable.title"]);
        expect(html).toContain(uk["shell.unavailable.body"]);
        expect(html).toContain(uk["shell.unavailable.retryNow"]);
        expect(html).not.toContain(">page<");
        expect(html).not.toContain(uk["error.load.retry"]);
    });

    it("the texts exist in both catalogs", () => {
        for (const key of ["error.page.title", "error.page.body", "error.page.reload", "error.page.back"] as const) {
            expect(uk[key]).toBeTruthy();
            expect(en[key]).toBeTruthy();
        }
    });
});
