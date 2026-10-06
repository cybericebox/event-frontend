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
