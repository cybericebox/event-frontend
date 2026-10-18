// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";

vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));

import en from "../../../../../messages/en.json";
import uk from "../../../../../messages/uk.json";
import {getImageAvailability} from "@/api/manageRegistries";
import {ImageUnavailableNotice} from "./ImageUnavailableNotice";

afterEach(cleanup);

describe("Образ недоступний", () => {
    it("reads the availability response and keys it by attachment", async () => {
        globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({Status: {Code: 0}, Data: [
            {EventExerciseID: "a1", ExerciseID: "x1", ExerciseName: "Web", Unavailable: [{Image: "acme/web:1", Status: "unavailable", Reason: "needs_event_secret"}]},
        ]}), {status: 200})) as typeof fetch;
        const map = await getImageAvailability("e1");
        expect(map.get("a1")?.[0]).toEqual({Image: "acme/web:1", Status: "unavailable", Reason: "needs_event_secret"});
        expect(String((vi.mocked(globalThis.fetch).mock.calls[0] as unknown[])[0])).toBe("https://api.test/api/events/e1/manage/images/availability");
    });

    it("warns with the image and the reason, and links to the registries", () => {
        render(<ImageUnavailableNotice items={[
            {Image: "acme/web:1", Status: "unavailable", Reason: "needs_event_secret"},
            {Image: "ghcr.io/acme/db", Status: "unavailable", Reason: "credential_conflict"},
        ]} canManage />);
        // A persistent notice, not an interruption.
        expect(screen.queryByRole("alert")).toBeNull();
        const alert = screen.getByRole("status");
        expect(alert.textContent).toContain("Образ недоступний");
        expect(alert.textContent).toContain("acme/web:1 — приватний або не існує");
        expect(alert.textContent).toContain("приватний або не існує");
        expect(alert.textContent).toContain("два різні токени");
        // The line is one message with the image and the reason as variables.
        expect(alert.querySelector("li")?.innerHTML).toBe("<code>acme/web:1</code> — приватний або не існує. Docker Hub відповідає так само на відсутній образ; для приватного додайте облікові дані реєстру.");
        expect(screen.getByRole("link", {name: "Додати облікові дані"}).getAttribute("href")).toBe("/manage/private-registries");
    });

    it("words the image line through one message in both languages", () => {
        expect((uk as Record<string, string>)["manage.registries.unavailableItem"]).toBe("{image} — {reason}");
        expect((en as Record<string, string>)["manage.registries.unavailableItem"]).toBe("{image} — {reason}");
    });

    it("shows nothing when every image is available", () => {
        const {container} = render(<ImageUnavailableNotice items={[]} canManage />);
        expect(container.innerHTML).toBe("");
    });
});
