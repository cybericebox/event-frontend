// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import type {ManageNotificationSubscription} from "@/api/manageNotifications";
import {SignalHead, SignalList} from "./SignalList";

afterEach(cleanup);

const row = (SignalType: string, patch: Partial<ManageNotificationSubscription> = {}): ManageNotificationSubscription =>
    ({SignalType, Channel: "email", Enabled: true, Audience: {kind: "all_participants"}, Source: "platform", Required: false, Config: {}, ...patch});

describe("SignalList", () => {
    const rows = [row("participant.event.finished"), row("participant.invitation.sent", {Required: true}), row("participant.event.start_reminder", {Enabled: false})];
    const signals = rows.map(item => item.SignalType);

    it("gives every signal a plain switch and no status wording", () => {
        render(<SignalList signals={signals} rows={rows} selected={signals[0]} canManage busy={false} ariaLabel="Листи" onSelect={vi.fn()} onToggle={vi.fn()} />);
        const switches = screen.getAllByRole("switch") as HTMLInputElement[];
        expect(switches.map(item => item.checked)).toEqual([true, false, true]);
        expect(screen.queryByText("Увімкнено")).toBeNull();
        expect(screen.queryByText("Вимкнено")).toBeNull();
    });

    it("toggles a signal and selects one by its name", () => {
        const onToggle = vi.fn();
        const onSelect = vi.fn();
        render(<SignalList signals={signals} rows={rows} selected={signals[0]} canManage busy={false} ariaLabel="Листи" onSelect={onSelect} onToggle={onToggle} />);
        fireEvent.click(screen.getByRole("switch", {name: "Надсилати «Нагадування про старт» для цього заходу"}));
        expect(onToggle).toHaveBeenCalledWith("participant.event.start_reminder", true);
        fireEvent.click(screen.getByRole("button", {name: "Запрошення надіслано"}));
        expect(onSelect).toHaveBeenCalledWith("participant.invitation.sent");
    });

    it("locks a required signal and every switch for a viewer or while busy", () => {
        const {rerender} = render(<SignalList signals={signals} rows={rows} selected={signals[0]} canManage busy={false} ariaLabel="Листи" onSelect={vi.fn()} onToggle={vi.fn()} />);
        const locked = screen.getByRole("switch", {name: "Надсилати «Запрошення надіслано» для цього заходу"}) as HTMLInputElement;
        expect(locked.disabled).toBe(true);
        rerender(<SignalList signals={signals} rows={rows} selected={signals[0]} canManage={false} busy={false} ariaLabel="Листи" onSelect={vi.fn()} onToggle={vi.fn()} />);
        expect((screen.getAllByRole("switch") as HTMLInputElement[]).every(item => item.disabled)).toBe(true);
    });
});

describe("SignalHead", () => {
    it("shows the switch with help and resets an event override", () => {
        const onReset = vi.fn();
        const onToggle = vi.fn();
        render(<SignalHead signal="participant.event.finished" row={row("participant.event.finished", {Source: "event"})} canManage busy={false} help="Довідка" requiredHelp="Завжди" onToggle={onToggle} onReset={onReset} />);
        fireEvent.click(screen.getByRole("switch", {name: "Надсилати для цього заходу"}));
        expect(onToggle).toHaveBeenCalledWith(false);
        fireEvent.click(screen.getByRole("button", {name: /Скинути/}));
        expect(onReset).toHaveBeenCalled();
        expect(screen.getByRole("button", {name: "Про поле «Захід завершено»"})).toBeTruthy();
    });

    it("offers no reset for an inherited setting", () => {
        render(<SignalHead signal="participant.event.finished" row={row("participant.event.finished")} canManage busy={false} help="Довідка" requiredHelp="Завжди" onToggle={vi.fn()} onReset={vi.fn()} />);
        expect(screen.queryByRole("button", {name: /Скинути/})).toBeNull();
    });
});
