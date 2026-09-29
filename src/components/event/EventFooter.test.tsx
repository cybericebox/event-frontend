// @vitest-environment jsdom
import {afterEach, expect, it} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {EventFooter} from "./EventFooter";

afterEach(cleanup);

it("carries the three-way theme switch", () => {
    render(<EventFooter />);
    const group = screen.getByRole("radiogroup", {name: "Тема оформлення"});
    expect(group.closest("footer")).toBeTruthy();
    expect(screen.getAllByRole("radio")).toHaveLength(3);
});
