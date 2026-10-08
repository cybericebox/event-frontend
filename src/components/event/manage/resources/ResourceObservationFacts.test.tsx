// @vitest-environment jsdom
import {afterEach, expect, it} from "vitest";
import {cleanup, render, screen, within} from "@testing-library/react";
import {AllocationFacts, ResourceObservationFacts} from "./ResourceObservationFacts";
import {allocation, observation} from "@/test/labObservations";
afterEach(cleanup);
it("renders Held once without adding its included pending and group breakdowns", () => {
    render(<ResourceObservationFacts observation={observation} />);
    expect(screen.getByTestId("observation-held").textContent).toBe("500 мілі-ядер · 1 КіБ");
    expect(screen.queryByText(/800 мілі/)).toBeNull();
    expect(screen.getByText("Фізичне сховище").parentElement?.textContent).toContain("Невідомо");
});
it("preserves incomplete nonzero Held and labels unknown contributors", () => {
    render(<ResourceObservationFacts observation={{...observation, Complete: false}} />);
    expect(screen.getByTestId("observation-held").textContent).toContain("500 мілі-ядер");
    expect(screen.getByText("Деякі складові невідомі")).toBeTruthy();
});
it("treats incomplete zero aggregates and missing observations as unknown", () => {
    const {rerender, container} = render(<ResourceObservationFacts observation={{...observation, Complete: false, Held: {...observation.Held, CPUMillicores: "0", MemoryBytes: "0"}}} />);
    expect(screen.getByTestId("observation-held").textContent).toBe("Невідомо");
    rerender(<ResourceObservationFacts observation={null} />);
    expect(container.querySelector("[data-empty-state]")).toBeTruthy();
});
it("keeps unknown usage and storage separate from retained quota", () => {
    render(<AllocationFacts resources={{...allocation, UsageAvailable: false}} />);
    expect(within(screen.getByText("Виміряне використання").parentElement!).getByText("Невідомо")).toBeTruthy();
    expect(screen.getByText("Утримана квота знімків").parentElement?.textContent).toContain("4 КіБ");
    expect(screen.getByText("Фізичне сховище").parentElement?.textContent).toContain("Невідомо");
});

it("does not turn unknown runtime or absent observation time into zero held/released capacity", () => {
    render(<AllocationFacts resources={{...allocation, RuntimeState: "Unknown", AllocatedRequests: {CPUMillicores: "0", MemoryBytes: "0"}}} />);
    expect(screen.getByText("Утримані ресурси").parentElement?.textContent).toContain("Невідомо");
    expect(screen.getByText("Підтверджено звільнено").parentElement?.textContent).toContain("Невідомо");
});

it("requires an explicit parent identity fence before trusting allocation release", () => {
    render(<AllocationFacts resources={{...allocation, RuntimeState: "Released", ReleasedRequests: {CPUMillicores: "500", MemoryBytes: "1024"}, PhysicalStorageBytesAvailable: true, PhysicalStorageBytes: "512"}} />);
    expect(screen.getByText("Підтверджено звільнено").parentElement?.textContent).toContain("Невідомо");
    expect(screen.getByText("Фізичне сховище").parentElement?.textContent).toContain("Невідомо");
});
it("retains Held and masks physical availability/currentness during a stale refresh", () => {
    render(<ResourceObservationFacts observation={{...observation, PhysicalStorageBytesAvailable: true, PhysicalStorageBytes: "512"}} stale />);
    expect(screen.getByTestId("observation-held").textContent).toContain("500 мілі-ядер");
    expect(screen.getByText("Фізичне сховище").parentElement?.textContent).toContain("Невідомо");
    expect(screen.queryByText("Спостереження актуальні")).toBeNull();
});
