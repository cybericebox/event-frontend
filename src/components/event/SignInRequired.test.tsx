// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";

vi.mock("@/utils/origins", () => ({idOrigin: "https://id.example.test", mainOrigin: "https://example.test", apiOrigin: "", eventOrigin: () => ""}));

import {SignInRequired} from "./SignInRequired";

afterEach(cleanup);

describe("SignInRequired", () => {
    it("shows a line and a sign-in button", () => {
        render(<SignInRequired />);
        expect(screen.getByRole("heading", {name: "Потрібен вхід"})).toBeTruthy();
        expect(screen.getByRole("link", {name: "Увійти"})).toBeTruthy();
    });

    it("the button leads to the ID sign-in with the current page as return address", () => {
        render(<SignInRequired />);
        const link = screen.getByRole("link", {name: "Увійти"}) as HTMLAnchorElement;
        link.addEventListener("click", e => e.preventDefault());
        fireEvent.click(link);
        expect(link.href).toBe(`https://id.example.test/sign-in?return_to=${encodeURIComponent(window.location.href)}`);
    });
});
