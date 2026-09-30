// @vitest-environment jsdom
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";

vi.mock("@/utils/origins", () => ({idOrigin: "https://id.example.test", mainOrigin: "https://example.test", apiOrigin: "", eventOrigin: () => ""}));

import {SignInRedirect} from "./SignInRedirect";

const replace = vi.fn();
const original = window.location;

function at(href: string) {
    const url = new URL(href);
    Object.defineProperty(window, "location", {configurable: true, value: {href, pathname: url.pathname, replace}});
}

beforeEach(() => at("https://ev.example.test/manage/tasks?tab=1"));
afterEach(() => {
    cleanup();
    replace.mockReset();
    Object.defineProperty(window, "location", {configurable: true, value: original});
});

describe("SignInRedirect", () => {
    it("replaces the address with the sign-in and shows the loader, no card or button", () => {
        render(<SignInRedirect />);
        expect(replace).toHaveBeenCalledTimes(1);
        expect(replace).toHaveBeenCalledWith(`https://id.example.test/sign-in?return_to=${encodeURIComponent("https://ev.example.test/manage/tasks?tab=1")}`);
        expect(screen.getByRole("status")).toBeTruthy();
        expect(screen.queryByRole("button")).toBeNull();
        expect(screen.queryByRole("link")).toBeNull();
    });

    it("does not redirect in a loop when it already runs on the sign-in page", () => {
        at("https://id.example.test/sign-in?return_to=x");
        render(<SignInRedirect />);
        expect(replace).toHaveBeenCalledTimes(1);
        expect(replace).toHaveBeenCalledWith("/");
    });

    it("does not reload the home page onto itself", () => {
        at("https://id.example.test/");
        render(<SignInRedirect />);
        expect(replace).not.toHaveBeenCalled();
    });
});
