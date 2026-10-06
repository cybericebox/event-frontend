import {describe, expect, it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";

import {EventBrandProvider} from "./EventBrandLogo";
import {ErrorPage, platformErrorCode} from "./ErrorPage";

describe("ErrorPage", () => {
    it("page mode: code, title, text, actions and the footer with the home and feedback links", () => {
        const html = renderToStaticMarkup(<ErrorPage mode="page" code={404} title="Не знайдено" text="Текст"><button type="button">Дія</button></ErrorPage>);
        expect(html).toContain("ib-error--page");
        expect(html).toContain('<main class="ib-error__main"');
        expect(html).toContain(">404<");
        expect(html).toContain("<h1");
        expect(html).toContain("ib-error__footer");
        expect(html).toContain("Cyber ICE Box");
        expect(html).toContain(">На головну<");
        expect(html).toContain(">Надіслати відгук<");
    });

    it("block mode: the column only, no footer, no brand", () => {
        const html = renderToStaticMarkup(<ErrorPage mode="block" code={500} title="Помилка"><button type="button">Дія</button></ErrorPage>);
        expect(html).toContain("ib-error--block");
        expect(html).toContain("<h2");
        expect(html).not.toContain("ib-error__footer");
        expect(html).not.toContain("crest-128");
    });

    it("shows the code line only for an error with a platform code", () => {
        expect(renderToStaticMarkup(<ErrorPage mode="block" code={500} title="x" refCode={50310} />)).toContain("Код помилки: 50310");
        expect(renderToStaticMarkup(<ErrorPage mode="block" code={500} title="x" />)).not.toContain("ib-error__ref");
        expect(platformErrorCode({status: 503})).toBeUndefined();
        expect(platformErrorCode({status: 503, code: 50310})).toBe(50310);
    });

    it("the footer brand is the event logo and name when the event is known, the crest when forced or unknown", () => {
        const known = <EventBrandProvider logoURL="https://cdn.example/logo.png" name="Кубок CTF"><ErrorPage mode="page" code={500} title="x" /></EventBrandProvider>;
        const html = renderToStaticMarkup(known);
        expect(html).toContain("logo.png");
        expect(html).toContain("Кубок CTF");
        expect(html).not.toContain("crest-128");
        const forced = renderToStaticMarkup(<EventBrandProvider logoURL="https://cdn.example/logo.png" name="Кубок CTF"><ErrorPage mode="page" code={404} title="x" platformBrand /></EventBrandProvider>);
        expect(forced).toContain("crest-128");
        expect(forced).not.toContain("Кубок CTF");
        expect(forced).not.toContain("logo.png");
    });

    it("a two-line title renders one span per line", () => {
        const html = renderToStaticMarkup(<ErrorPage mode="page" code={404} title={["Один", "Два"]} />);
        expect(html.match(/ib-error__line/g)).toHaveLength(2);
    });
});
