// @vitest-environment jsdom
import {afterEach, beforeAll, expect, it} from "vitest";
import {act, cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {useState} from "react";
import {EventSelect} from "./EventSelect";
import {ConfirmDialog} from "./ConfirmDialog";

beforeAll(() => {
    HTMLDialogElement.prototype.showModal = function () {this.open = true;};
    HTMLDialogElement.prototype.close = function () {this.open = false;};
});
afterEach(cleanup);

// The live editor's «Скопіювати з…» (owner, 2026-10-25): a choice in the menu opens a confirmation at once.
function CopyFrom() {
    const [asked, setAsked] = useState<string | null>(null);
    return <>
        <EventSelect ariaLabel="Скопіювати з…" value="" onValueChange={setAsked} options={[{value: "running", label: "Триває"}, {value: "finished", label: "Завершено"}]} />
        <ConfirmDialog open={asked !== null} onCancel={() => setAsked(null)} title="Замінити екран?" confirmLabel="Замінити" busyLabel="…" onConfirm={() => setAsked(null)} />
    </>;
}

it("leaves the page clickable after a menu choice opened and closed a confirmation", async () => {
    render(<CopyFrom />);
    fireEvent.pointerDown(screen.getByRole("button", {name: "Скопіювати з…"}), {button: 0, ctrlKey: false});
    fireEvent.click(await screen.findByRole("menuitemradio", {name: "Триває"}));
    await screen.findByText("Замінити екран?");
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 50));});
    fireEvent.click(screen.getByRole("button", {name: "Скасувати"}));
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 50));});
    await waitFor(() => expect(document.body.style.pointerEvents).not.toBe("none"));
});
