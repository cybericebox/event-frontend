// @vitest-environment jsdom
import {afterEach, expect, it} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import type {ContentBlock} from "@/types/eventContent";
import {t} from "@/i18n/t";
import {blockDataWarning} from "../manage/previewScenario";
import {ContentBlocks} from "./ContentBlocks";

afterEach(cleanup);

const countdown: ContentBlock = {id: "c", type: "countdown", title: "До завершення", targetVariable: "event.finish", dateSource: "event"};
const hero: ContentBlock = {id: "h", type: "hero", title: "Захід", targetVariable: "event.finish", dateSource: "event"};
const catalog = [{name: "event.finish", label: "Час завершення заходу", format: "date-time", audience: 0}] as never;

it("renders nothing for a countdown without a date on the site", () => {
    const {container} = render(<ContentBlocks document={{blocks: [countdown]}} variables={{"event.finish": null}} />);
    expect(container.querySelector(".ib-block-countdown")).toBeNull();
    expect(screen.queryByText("До завершення")).toBeNull();
});

it("shows the countdown once the date is set", () => {
    const {container} = render(<ContentBlocks document={{blocks: [countdown]}} variables={{"event.finish": "2099-01-01T00:00:00Z"}} />);
    expect(container.querySelector(".ib-block-countdown")).not.toBeNull();
});

it("hides only the hero timer without a date", () => {
    const {container} = render(<ContentBlocks document={{blocks: [hero]}} variables={{"event.finish": ""}} />);
    expect(screen.getByText("Захід")).toBeTruthy();
    expect(container.querySelector(".ib-timer")).toBeNull();
});

it("keeps the dimmed block in the preview", () => {
    const {container} = render(<ContentBlocks document={{blocks: [countdown]}} variables={{}} preview />);
    expect(container.querySelector(".ib-block-countdown[data-preview-gap]")).not.toBeNull();
});

it("names the missing field in the editor warning", () => {
    const warning = blockDataWarning(countdown, {}, catalog);
    expect(warning?.message).toBe(t("manage.blocks.action.warning.countdownNamed", {name: "Час завершення заходу"}));
    expect(warning?.href).toBe("/manage/schedule");
});

it("has no editor warning when the date is set", () => {
    expect(blockDataWarning(countdown, {"event.finish": "2099-01-01T00:00:00Z"}, catalog)).toBeNull();
});

it("drops the hero timer and its note on the site once the target time has come, keeps them in the editor", () => {
    const withNote: ContentBlock = {...hero, note: "До старту залишилось"};
    const past = {"event.finish": "2020-01-01T00:00:00Z"};
    const {container} = render(<ContentBlocks document={{blocks: [withNote]}} variables={past} initialNow={Date.parse("2026-01-01T00:00:00Z")} />);
    expect(screen.getByText("Захід")).toBeTruthy();
    expect(container.querySelector(".ib-timer")).toBeNull();
    expect(screen.queryByText("До старту залишилось")).toBeNull();
    cleanup();
    render(<ContentBlocks document={{blocks: [withNote]}} variables={{"event.finish": "2099-01-01T00:00:00Z"}} />);
    expect(screen.getByText("До старту залишилось")).toBeTruthy();
    cleanup();
    render(<ContentBlocks document={{blocks: [withNote]}} variables={past} preview />);
    expect(screen.getByText("До старту залишилось")).toBeTruthy();
});

it("marks the layout variants on the countdown block", () => {
    const vars = {"event.finish": "2099-01-01T00:00:00Z"};
    const classes = (variant?: string) => {
        const {container} = render(<ContentBlocks document={{blocks: [{...countdown, variant}]}} variables={vars} />);
        const className = container.querySelector(".ib-block-countdown")?.className ?? "";
        cleanup();
        return className;
    };
    expect(classes("inline")).toContain("ib-block-countdown--inline");
    expect(classes("inline")).not.toContain("ib-block-countdown--center");
    expect(classes("center")).toContain("ib-block-countdown--center");
    expect(classes("split")).not.toMatch(/--(inline|center)\b/);
});
