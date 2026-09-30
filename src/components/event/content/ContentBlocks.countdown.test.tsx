// @vitest-environment jsdom
import {afterEach, expect, it} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import type {ContentBlock} from "@/types/eventContent";
import {t} from "@/i18n/t";
import {BlockDataGapNotice} from "../manage/BlockDataGapNotice";
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

it("names the missing field in the editor notice", () => {
    render(<BlockDataGapNotice block={countdown} values={{}} catalog={catalog} />);
    expect(screen.getByRole("status").textContent).toContain(t("manage.blocks.gap.countdownNamed", {name: "Час завершення заходу"}));
    expect(screen.getByRole("link").getAttribute("href")).toBe("/manage/schedule");
});

it("shows no editor notice when the date is set", () => {
    render(<BlockDataGapNotice block={countdown} values={{"event.finish": "2099-01-01T00:00:00Z"}} catalog={catalog} />);
    expect(screen.queryByRole("status")).toBeNull();
});
