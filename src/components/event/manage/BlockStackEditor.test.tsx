// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {useState} from "react";
import {cleanup, fireEvent, render, screen, within} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import type {ContentBlock, ContentDocument} from "@/types/eventContent";
import {t} from "@/i18n/t";
import {BlockStackEditor} from "./BlockStackEditor";

vi.mock("@/api/clientAuth", () => ({
    getCurrentUser: vi.fn(async () => null),
    getJoinStatus: vi.fn(async () => 0),
    getInvitationInfo: vi.fn(async () => ({Status: 0, Invited: false})),
}));
vi.mock("@/api/manage", () => ({
    getManagePages: vi.fn(async () => []),
    getManageContent: vi.fn(async () => ({})),
    uploadManageBannerImage: vi.fn(),
}));

afterEach(cleanup);
// jsdom has no element scrolling; the preview scrolls to the selected block.
Element.prototype.scrollTo = () => {};

const first: ContentBlock = {id: "first", type: "section", label: "Перший", variant: "left"};
const second: ContentBlock = {id: "second", type: "section", label: "Другий", variant: "left"};

function Harness({validation = null}: {validation?: string | null}) {
    const [document, setDocument] = useState<ContentDocument>({blocks: [first, second]});
    return <QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}>
        <BlockStackEditor editorKey="e:landing" eventID="e" coverImage="" document={document} catalog={[]} values={{}} validation={validation} canEdit previewTitle="" onChange={update => setDocument(update)} />
    </QueryClientProvider>;
}

const block = (n: number) => screen.getByRole("region", {name: new RegExp(` ${n}$`)});
const titleToggle = (n: number) => block(n).querySelector<HTMLButtonElement>(".event-content-editor__block-title")!;
const isOpen = (n: number) => block(n).querySelector(".event-content-editor__block-body") !== null;
const chevron = (n: number) => block(n).querySelector<HTMLButtonElement>(".event-content-editor__block-toggle")!;

describe("collapsible blocks", () => {
    it("toggles a block from its header and chevron with accessible state", () => {
        render(<Harness />);
        expect(isOpen(1)).toBe(false);
        const title = titleToggle(1);
        expect(title.getAttribute("aria-label")).toBe(t("manage.blocks.toggle.expand"));
        expect(title.getAttribute("aria-controls")).toBe("block-body-first");
        fireEvent.click(title);
        expect(isOpen(1)).toBe(true);
        expect(title.getAttribute("aria-expanded")).toBe("true");
        expect(chevron(1).getAttribute("aria-expanded")).toBe("true");
        expect(chevron(1).getAttribute("aria-label")).toBe(t("manage.blocks.toggle.collapse"));
        expect(block(1).querySelector("#block-body-first")).not.toBeNull();
        fireEvent.click(chevron(1));
        expect(isOpen(1)).toBe(false);
        // Clicking the empty part of the row toggles too.
        fireEvent.click(block(1).querySelector(".event-content-editor__block-head")!);
        expect(isOpen(1)).toBe(true);
    });

    it("ignores clicks on the header's action buttons", () => {
        render(<Harness />);
        fireEvent.click(screen.getByRole("button", {name: t("manage.blocks.duplicateAria", {n: 2})}));
        expect(screen.getAllByRole("region").filter(region => region.hasAttribute("data-editor-block-id"))).toHaveLength(3);
        expect(isOpen(2)).toBe(false);
        // The duplicate is a new block, so it opens.
        expect(isOpen(3)).toBe(true);
        fireEvent.click(screen.getByRole("button", {name: t("manage.blocks.move.downAria", {n: 1})}));
        expect(isOpen(1)).toBe(false);
    });

    it("keeps the open state when a block moves", () => {
        render(<Harness />);
        fireEvent.click(titleToggle(1));
        fireEvent.click(screen.getByRole("button", {name: t("manage.blocks.move.downAria", {n: 1})}));
        expect(block(2).getAttribute("data-editor-block-id")).toBe("first");
        expect(isOpen(2)).toBe(true);
        expect(isOpen(1)).toBe(false);
    });

    it("opens a newly added block", () => {
        render(<Harness />);
        const palette = screen.getByLabelText(t("manage.blocks.stack.add"));
        fireEvent.click(within(palette).getByRole("button", {name: t("manage.blocks.type.divider")}));
        expect(isOpen(3)).toBe(true);
    });

    it("collapses every block while dragging and restores them after the drop", () => {
        render(<Harness />);
        fireEvent.click(titleToggle(2));
        expect(isOpen(2)).toBe(true);
        const handle = screen.getByRole("button", {name: t("manage.blocks.drag.aria", {n: 1})});
        handle.setPointerCapture = () => {};
        fireEvent.pointerDown(handle, {button: 0, pointerId: 1, clientX: 5, clientY: 5});
        expect(isOpen(1)).toBe(false);
        expect(isOpen(2)).toBe(false);
        fireEvent.pointerUp(handle, {pointerId: 1});
        expect(isOpen(1)).toBe(false);
        expect(isOpen(2)).toBe(true);
        document.querySelectorAll(".event-content-editor__drag-ghost").forEach(node => node.remove());
    });

    it("opens a collapsed block that gets a validation error", () => {
        const {rerender} = render(<Harness />);
        expect(isOpen(2)).toBe(false);
        rerender(<Harness validation={t("manage.validation.block", {index: 2, message: t("manage.validation.sectionLabel")})} />);
        expect(isOpen(2)).toBe(true);
        expect(block(2).className).toContain("is-invalid");
        // The author may close it again; the outline stays as the indicator.
        fireEvent.click(chevron(2));
        expect(isOpen(2)).toBe(false);
        expect(block(2).className).toContain("is-invalid");
    });
});
