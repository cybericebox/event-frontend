import {describe, expect, it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {FormQuestion, QuestionSelect, questionControlProps} from "./FormQuestion";

describe("FormQuestion", () => {
    it("labels a simple control and marks it required for screen readers", () => {
        const html = renderToStaticMarkup(<FormQuestion id="q1" label="Місто" required help="Де ви живете"><input {...questionControlProps("q1", true, "Де ви живете")} /></FormQuestion>);
        expect(html).toContain('<label class="ib-field__label" for="q1">');
        expect(html).toContain('<span aria-hidden="true">*</span>');
        expect(html).toContain("ib-sr");
        expect(html).toContain('aria-required="true"');
        expect(html).toContain('aria-describedby="q1-help"');
        expect(html).not.toContain("<fieldset");
    });

    it("uses a fieldset with a legend for a group of controls", () => {
        const html = renderToStaticMarkup(<FormQuestion id="q2" label="Мови" group><input type="checkbox" /></FormQuestion>);
        expect(html).toContain("<fieldset");
        expect(html).toContain('<legend class="ib-field__label">Мови</legend>');
        expect(html).not.toContain("<label");
    });

    it("shows the error inline and wires it to the control", () => {
        const html = renderToStaticMarkup(<FormQuestion id="q3" label="Роль" error="Заповніть"><QuestionSelect {...questionControlProps("q3", false, undefined, "Заповніть")} value="" onChange={() => undefined} options={["А"]} /></FormQuestion>);
        expect(html).toContain("ib-field event-join-question is-invalid");
        expect(html).toContain('<p class="ib-field__error" id="q3-error" role="alert">Заповніть</p>');
        expect(html).toContain('aria-invalid="true"');
        expect(html).toContain('aria-describedby="q3-error"');
        expect(html).toContain('class="ib-select"');
    });
});
