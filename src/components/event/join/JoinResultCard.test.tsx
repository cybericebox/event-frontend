// @vitest-environment jsdom
import {afterEach, expect, it} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {CircleCheck, CircleX, Clock} from "lucide-react";
import {JoinResultCard, joinResultIcons} from "./JoinResultCard";

afterEach(cleanup);

it("maps every outcome to its icon", () => {
    expect(joinResultIcons).toEqual({approved: CircleCheck, pending: Clock, rejected: CircleX});
});

it.each(["approved", "pending", "rejected"] as const)("renders the %s card with its tone class, text and action", outcome => {
    const {container} = render(<JoinResultCard outcome={outcome} title="Заголовок" text="Рядок" action={<button>Далі</button>} />);
    const card = container.firstElementChild!;
    expect(card.className).toContain(`event-join-result--${outcome}`);
    expect(card.querySelector(".event-join-result__icon svg")).not.toBeNull();
    expect(screen.getByRole("heading", {name: "Заголовок"})).toBeTruthy();
    expect(screen.getByText("Рядок")).toBeTruthy();
    expect(screen.getByRole("button", {name: "Далі"})).toBeTruthy();
});

it("omits the action row without an action", () => {
    const {container} = render(<JoinResultCard outcome="pending" title="a" text="b" />);
    expect(container.querySelector(".event-join-result__acts")).toBeNull();
});
