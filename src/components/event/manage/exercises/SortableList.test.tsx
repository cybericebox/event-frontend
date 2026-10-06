// @vitest-environment jsdom
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {keyboardDrag, stackLayout} from "@/components/ui/sortableTestUtils";
import {t} from "@/i18n/t";
import {SortableList} from "./SortableList";

let restoreLayout: () => void;
beforeAll(() => {restoreLayout = stackLayout();});
afterAll(() => restoreLayout());
afterEach(cleanup);

const names = ["Альфа", "Браво", "Чарлі", "Дельта"];

function renderList(onReorder: (ids: string[]) => void, disabled = false) {
    render(<SortableList ariaLabel="groups" items={names} itemID={name => name} itemName={name => name} disabled={disabled} onReorder={onReorder}
        renderItem={name => ({content: name})} />);
}

const grip = (name: string) => screen.getByRole("button", {name: t("manage.challenges.order.dragNamed", {name})});

describe("SortableList", () => {
    it("reorders by several positions with the keyboard", async () => {
        const onReorder = vi.fn();
        renderList(onReorder);
        await keyboardDrag(grip("Альфа"), 3);
        expect(onReorder).toHaveBeenLastCalledWith(["Браво", "Чарлі", "Дельта", "Альфа"]);
        await keyboardDrag(grip("Чарлі"), -2);
        expect(onReorder).toHaveBeenLastCalledWith(["Чарлі", "Альфа", "Браво", "Дельта"]);
    });

    it("keeps the up and down buttons", () => {
        const onReorder = vi.fn();
        renderList(onReorder);
        fireEvent.click(screen.getByRole("button", {name: t("manage.challenges.order.moveDown", {name: "Браво"})}));
        expect(onReorder).toHaveBeenCalledWith(["Альфа", "Чарлі", "Браво", "Дельта"]);
    });

    it("does not drag when disabled", async () => {
        const onReorder = vi.fn();
        renderList(onReorder, true);
        await keyboardDrag(grip("Альфа"), 2);
        expect(onReorder).not.toHaveBeenCalled();
    });
});
