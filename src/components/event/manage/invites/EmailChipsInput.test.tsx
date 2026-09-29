// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {useState} from "react";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {EmailChipsInput} from "./EmailChipsInput";
import type {EmailChip} from "./emailChips";

function Harness({onChips}: {onChips?: (chips: EmailChip[]) => void}) {
    const [chips, setChips] = useState<EmailChip[]>([]);
    return <EmailChipsInput id="emails" chips={chips} onChange={next => {setChips(next); onChips?.(next);}} />;
}

afterEach(cleanup);

describe("EmailChipsInput", () => {
    it("turns typed addresses into chips on a separator and skips repeats", () => {
        render(<Harness />);
        const input = screen.getByRole("textbox");
        fireEvent.change(input, {target: {value: "a@example.test,"}});
        fireEvent.change(input, {target: {value: "A@Example.test "}});
        fireEvent.change(input, {target: {value: "b@example.test"}});
        fireEvent.keyDown(input, {key: "Enter"});
        expect(screen.getAllByText(/@example\.test$/).map(node => node.textContent)).toEqual(["a@example.test", "b@example.test"]);
        expect((input as HTMLInputElement).value).toBe("");
    });

    it("marks invalid addresses and removes the last chip with Backspace", () => {
        let latest: EmailChip[] = [];
        render(<Harness onChips={chips => {latest = chips;}} />);
        const input = screen.getByRole("textbox");
        fireEvent.paste(input, {clipboardData: {getData: () => "ok@example.test\nbroken"}});
        expect(latest.map(chip => [chip.email, chip.valid])).toEqual([["ok@example.test", true], ["broken", false]]);
        expect(screen.getByText("broken").closest(".event-chip")?.className).toContain("is-invalid");
        fireEvent.keyDown(input, {key: "Backspace"});
        expect(latest.map(chip => chip.email)).toEqual(["ok@example.test"]);
    });
});
