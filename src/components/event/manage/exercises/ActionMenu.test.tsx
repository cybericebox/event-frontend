// @vitest-environment jsdom
import {afterEach, describe, expect, it} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {Pencil} from "lucide-react";
import {ActionMenu} from "./ActionMenu";

afterEach(cleanup);

describe("ActionMenu", () => {
    it("is hidden when there is nothing to do", () => {
        render(<ActionMenu label="Дії" items={[]} />);
        expect(screen.queryByRole("button")).toBeNull();
        render(<ActionMenu label="Дії" items={[{key: "edit", label: "Редагувати", icon: Pencil}]} />);
        expect(screen.getByRole("button", {name: "Дії"})).toBeTruthy();
    });
});
