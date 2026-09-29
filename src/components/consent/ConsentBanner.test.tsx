// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {act, cleanup, fireEvent, render, screen} from "@testing-library/react";
import {ConsentBanner} from "./ConsentBanner";
import {openConsentSettings} from "@/utils/consent";

afterEach(() => {
    cleanup();
    document.cookie = "cib_consent=; path=/; max-age=0";
});

describe("ConsentBanner", () => {
    it("asks when no choice exists and hides after a choice", () => {
        render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />);
        expect(screen.getByRole("region")).toBeTruthy();
        fireEvent.click(screen.getByRole("button", {name: "Відхилити"}));
        expect(screen.queryByRole("region")).toBeNull();
        expect(document.cookie).toContain("cib_consent=denied");
    });

    it("stays hidden once a choice exists, until reopened; Esc closes without changing it", () => {
        document.cookie = "cib_consent=granted; path=/";
        render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />);
        expect(screen.queryByRole("region")).toBeNull();
        act(() => openConsentSettings());
        const region = screen.getByRole("region");
        expect(document.activeElement).toBe(region);
        fireEvent.keyDown(region, {key: "Escape"});
        expect(screen.queryByRole("region")).toBeNull();
        expect(document.cookie).toContain("cib_consent=granted");
    });

    it("never shows when GA is not configured", () => {
        render(<ConsentBanner gaId="" policyHref="/cookies" />);
        expect(screen.queryByRole("region")).toBeNull();
    });

    it("Esc without a stored choice does not dismiss or consent", () => {
        render(<ConsentBanner gaId="G-TEST" policyHref="/cookies" />);
        fireEvent.keyDown(screen.getByRole("region"), {key: "Escape"});
        expect(screen.getByRole("region")).toBeTruthy();
        expect(document.cookie).not.toContain("cib_consent");
    });
});
