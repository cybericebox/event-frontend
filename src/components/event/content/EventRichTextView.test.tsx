import {describe, expect, it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {EventRichTextView} from "./EventRichTextView";

describe("EventRichTextView", () => {
    it("renders saved formatting and current date variable as literal text", () => {
        const value = {root: {type: "root", children: [{type: "paragraph", format: "center", children: [{type: "text", text: "Початок ", format: 1}, {type: "variable", varName: "event.startAt", formats: ["italic"]}]}]}};
        const html = renderToStaticMarkup(<EventRichTextView value={value} variables={{"event.startAt": "2026-09-30T01:17:09+03:00"}} dateDisplays={{"event.startAt": {format: "custom", pattern: "HH:mm:ss"}}} />);
        expect(html).toContain("text-align:center");
        expect(html).toContain("<strong>Початок </strong>");
        expect(html).toContain("01:17:09");
        expect(html).toContain("event-lexical__variable");
        expect(html).not.toContain("{{");
    });
    it("never renders an unsafe link or an unknown node", () => {
        const value = {root: {type: "root", children: [{type: "paragraph", children: [{type: "link", url: "javascript:alert(1)", children: [{type: "text", text: "click"}]}, {type: "script", children: [{type: "text", text: "bad"}]}]}]}};
        const html = renderToStaticMarkup(<EventRichTextView value={value} />);
        expect(html).toContain("click");
        expect(html).not.toContain("href=");
        expect(html).not.toContain("bad");
    });
    it("renders H4 through H6 with their own heading styles", () => {
        const children = ["h4", "h5", "h6"].map(tag => ({type: "heading", tag, children: [{type: "text", text: tag}]}));
        const html = renderToStaticMarkup(<EventRichTextView value={{root: {type: "root", children}}} />);
        for (const tag of ["h4", "h5", "h6"]) expect(html).toContain(`<${tag} class="event-lexical__${tag}"><span>${tag}</span></${tag}>`);
    });
});
