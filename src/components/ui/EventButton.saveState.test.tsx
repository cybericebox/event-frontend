// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {EventButton} from "./EventButton";

vi.mock("@/components/event/EventBrandLogo", () => ({EventBrandLogo: () => <span data-testid="busy-logo" />}));
afterEach(cleanup);

describe("explicit save action", () => {
    it("reserves space but removes a clean action from interaction and accessibility", () => {
        const save = vi.fn();
        const {container, rerender} = render(<EventButton saveDirty={false} onClick={save}>Save</EventButton>);
        const button = container.querySelector("button")!;
        expect(button.style.visibility).toBe("hidden");
        expect(button.disabled).toBe(true);
        expect(screen.queryByRole("button", {name: "Save"})).toBeNull();
        fireEvent.click(button);
        expect(save).not.toHaveBeenCalled();
        rerender(<EventButton saveDirty onClick={save}>Save</EventButton>);
        fireEvent.click(screen.getByRole("button", {name: "Save"}));
        expect(save).toHaveBeenCalledOnce();
        rerender(<EventButton saveDirty={false} busy>Save</EventButton>);
        expect(screen.getByRole("button", {name: "Save"}).getAttribute("aria-busy")).toBe("true");
    });
});
