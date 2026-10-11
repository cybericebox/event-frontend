// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {PageBlockEditor} from "./PageBlockEditor";
import type {ContentBlock} from "@/types/eventContent";
import type {ContentVariableDefinition} from "@/components/event/content/variableCatalog";

vi.mock("@/api/manage", () => ({getManagePages: vi.fn(async () => []), getManageContent: vi.fn(async () => ({})), uploadManageBannerImage: vi.fn()}));
afterEach(cleanup);

const catalog: ContentVariableDefinition[] = [{name: "event.name", label: "Назва заходу", format: "text", audience: 0}];

function setup(canEdit = true) {
    const update = vi.fn();
    const block: ContentBlock = {id: "heading", type: "countdown", title: "Мій захід"};
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
        <PageBlockEditor eventID="event-1" coverImage="" block={block} index={0} count={1} values={{"event.name": "CTF"}} catalog={catalog} canEdit={canEdit} selected onSelect={() => {}} onUpdate={update} onMove={() => {}} onDelete={() => {}} />
    </QueryClientProvider>);
    return update;
}

describe("page block variable picker", () => {
    it("opens from the real button and inserts at the remembered caret", async () => {
        const update = setup();
        const input = screen.getByRole("textbox", {name: "Заголовок"});
        const range = document.createRange();
        range.setStart(input.firstChild!, 4);
        range.collapse(true);
        window.getSelection()!.removeAllRanges();
        window.getSelection()!.addRange(range);
        fireEvent.mouseUp(input);
        const button = screen.getByRole("button", {name: "Вставити змінну в поле «Заголовок»"});
        fireEvent.click(button);
        const menu = await screen.findByRole("dialog");
        expect(button.closest(".ib-tip")?.parentElement?.closest(".ib-tip")).toBeNull();
        fireEvent.click(within(menu).getByRole("button", {name: /Назва заходу/}));
        expect(update).toHaveBeenCalledWith(expect.objectContaining({title: "Мій {{event.name}}захід", variables: [{name: "event.name", format: "text"}]}));
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("keeps variable insertion disabled for read-only content", () => {
        setup(false);
        const button = screen.getByRole("button", {name: "Вставити змінну в поле «Заголовок»"}) as HTMLButtonElement;
        expect(button.disabled).toBe(true);
        fireEvent.click(button);
        expect(screen.queryByRole("dialog")).toBeNull();
    });
});
