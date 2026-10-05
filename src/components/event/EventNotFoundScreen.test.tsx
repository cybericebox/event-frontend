// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";

vi.mock("./EventBrandLogo", () => ({EventBrandLogo: () => <img alt="" data-testid="event-logo" />}));

import {EventNotFoundScreen} from "./EventNotFoundScreen";

afterEach(cleanup);

describe("EventNotFoundScreen", () => {
    it("says there is no such event, with the way to the platform and no event branding", () => {
        render(<EventNotFoundScreen />);
        expect(screen.getByRole("heading", {name: "Такого заходу не існує"})).toBeTruthy();
        expect(screen.getByRole("link", {name: /^На головну Cyber\sICE\sBox$/})).toBeTruthy();
        expect(screen.queryByRole("link", {name: "Увійти"})).toBeNull();
        expect(screen.queryByTestId("event-logo")).toBeNull();
        expect(document.title).toBe("Такого заходу не існує");
    });
});
