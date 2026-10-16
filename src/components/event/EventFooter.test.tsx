// @vitest-environment jsdom
import {afterEach, expect, it} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {EventFooter} from "./EventFooter";

afterEach(cleanup);

it("carries the three-way theme switch", () => {
    render(<EventFooter />);
    const group = screen.getByRole("radiogroup", {name: "Тема оформлення"});
    expect(group.closest("footer")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
});

it("carries «Надіслати відгук» next to the cookie settings, naming the event", () => {
    render(<EventFooter eventName="Test" />);
    const link = screen.getByRole("link", {name: "Надіслати відгук"});
    expect(link.closest("footer")).toBeTruthy();
    expect(link.getAttribute("href")).toContain(encodeURIComponent("«Test»"));
    expect(link.closest("nav")).toBe(screen.getByRole("link", {name: /cookie/}).closest("nav"));
});

it("omits the external theme selector for authenticated shells", () => {
    render(<EventFooter showTheme={false} />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.getByRole("link", {name: "Надіслати відгук"})).toBeTruthy();
});

it("replaces only the signature with safe event rich text", () => {
    const signature = {root: {type: "root" as const, children: [{type: "paragraph", children: [{type: "text", text: "© Local event "}, {type: "link", url: "https://partner.example/", children: [{type: "text", text: "Partner"}]}, {type: "link", url: "javascript:alert(1)", children: [{type: "text", text: "Unsafe"}]}]}]}};
    render(<EventFooter signature={signature} showTheme={false} />);
    expect(screen.getByText("© Local event")).toBeTruthy();
    expect(screen.getByRole("link", {name: "Partner"}).getAttribute("href")).toBe("https://partner.example/");
    expect(screen.queryByRole("link", {name: "Unsafe"})).toBeNull();
    expect(screen.queryByText(/За підтримки/)).toBeNull();
    expect(screen.getByRole("link", {name: /cookie/})).toBeTruthy();
    expect(screen.getByRole("link", {name: "Надіслати відгук"})).toBeTruthy();
});

it.each([null, {root: {type: "root" as const, children: [{type: "paragraph", children: []}]}}])("uses the platform signature when the custom document is empty", signature => {
    render(<EventFooter signature={signature} />);
    expect(screen.getByText(/Cyber.*ICE.*Box/)).toBeTruthy();
});
