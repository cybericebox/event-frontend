import {describe, expect, it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";

import uk from "../../../messages/uk.json";
import en from "../../../messages/en.json";
import {EventBrandProvider} from "./EventBrandLogo";
import {NotFoundScreen} from "./NotFoundScreen";

describe("NotFoundScreen", () => {
    it("shows the event logo and name when the event is known", () => {
        const html = renderToStaticMarkup(<EventBrandProvider logoURL="https://cdn.example/logo.png" name="Кубок CTF"><NotFoundScreen /></EventBrandProvider>);
        expect(html).toContain('src="https://cdn.example/logo.png"');
        expect(html).toContain("Кубок CTF");
        expect(html).not.toContain("crest-128");
        expect(html).toContain("Сторінку не знайдено");
        expect(html).toContain(uk["error.notFoundDescription"]);
        expect(html).toContain('href="/"');
        expect(html).toContain(">На головну<");
        expect(html).toContain(">Назад<");
        expect(html).toContain("event-error--page");
    });

    it("falls back to the crest and the wordmark when the event is unknown", () => {
        const html = renderToStaticMarkup(<NotFoundScreen />);
        expect(html).toContain("crest-128");
        expect(html).toContain("Cyber <span");
        expect(html).toContain("ICE</span> Box");
        expect(html).toContain(">Назад<");
    });

    it("takes a context title and body, and the block variant is not full page", () => {
        const html = renderToStaticMarkup(<NotFoundScreen block title="Шаблон не знайдено" body="Такого шаблону немає." />);
        expect(html).toContain("Шаблон не знайдено");
        expect(html).toContain("Такого шаблону немає.");
        expect(html).not.toContain("event-error--page");
    });

    it("has the texts in both catalogs", () => {
        for (const key of ["error.notFound", "error.notFoundDescription", "error.goHome", "manage.notifications.templateNotFoundTitle"] as const) {
            expect(uk[key]).toBeTruthy();
            expect(en[key]).toBeTruthy();
        }
    });
});
