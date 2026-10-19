// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen, within} from "@testing-library/react";
import type {PublicEventInfo} from "@/types/publicEventInfo";
import {TemplateList} from "./TemplateList";

afterEach(cleanup);

const FINISHED = "participant.event.finished";
const STARTED = "participant.event.started";
const event = {EventID: "e", Name: "CTF"} as PublicEventInfo;
const version = (ID: string, NotificationType: string, Status: "draft" | "published", Source: "platform" | "event" = "event") => ({ID, NotificationType, Status, UpdatedAt: "2026-10-01T10:00:00Z", Source});

function list() {
    return render(<TemplateList event={event} state="ready" onRetry={vi.fn()} loadingLabel="" errorMessage="" emptyMessage="" signals={[FINISHED, STARTED]} rows={[]}
        templates={[version("1", FINISHED, "published"), version("2", FINISHED, "draft"), version("3", STARTED, "published", "platform")]} basePath="/manage/email" canManage onToggle={vi.fn()} />);
}

describe("template list", () => {
    it("shows the status once, with one link to the versions instead of a link per status", () => {
        list();
        const [, finished] = screen.getAllByRole("row");
        expect(within(finished).queryByRole("link", {name: "Опублікована"})).toBeNull();
        expect(within(finished).getByRole("link", {name: "Версії (2)"}).getAttribute("href")).toBe(`/manage/email/${FINISHED}`);
    });

    it("draws the default-template status as a plain tag, not as a button-like outline", () => {
        list();
        const [, , started] = screen.getAllByRole("row");
        const tag = within(started).getByText("Шаблон за замовчуванням");
        expect(tag.className).not.toContain("ib-tag--role");
        expect(within(started).queryByRole("link", {name: /Версії/})).toBeNull();
    });
});
