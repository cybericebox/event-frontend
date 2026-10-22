// @vitest-environment jsdom
import {describe, expect, it} from "vitest";
import {render} from "@testing-library/react";
import {LivePlaceMark} from "./LiveMarks";

describe("live place mark", () => {
    it("shows places after the third as numbers whatever the mark", () => {
        const {container} = render(<LivePlaceMark place={4} marker="cups" images={null} />);
        expect(container.textContent).toBe("4");
        expect(container.querySelector(".live-mark--number")).not.toBeNull();
    });

    it("draws a cup, a medal or a medal circle for places 1–3", () => {
        expect(render(<LivePlaceMark place={1} marker="cups" images={null} />).container.querySelector(".live-mark--icon.is-place-1 svg")).not.toBeNull();
        expect(render(<LivePlaceMark place={2} marker="medal-icons" images={null} />).container.querySelector("text")?.textContent).toBe("2");
        expect(render(<LivePlaceMark place={3} marker="medals" images={null} />).container.querySelector(".live-mark--medal.is-place-3")?.textContent).toBe("3");
    });

    it("falls back to the cup without the picture of the place", () => {
        const {container} = render(<LivePlaceMark place={2} marker="images" images={null} />);
        expect(container.querySelector(".live-mark--icon svg")).not.toBeNull();
        expect(container.querySelector("img")).toBeNull();
    });
});
