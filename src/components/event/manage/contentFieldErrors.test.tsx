// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {PageBlockEditor} from "./PageBlockEditor";
import {landingProblems} from "./validatePageBlocks";
import type {ContentBlock} from "@/types/eventContent";
import type {ContentVariableDefinition} from "../content/variableCatalog";

vi.mock("@/api/manage", async original => ({...await original<typeof import("@/api/manage")>(),getManagePages: vi.fn(async () => []), getManageContent: vi.fn(async () => ({})), uploadManageBannerImage: vi.fn()}));
afterEach(cleanup);
const catalog: ContentVariableDefinition[] = [{name: "event.count", label: "Кількість", format: "number", audience: 0}];
function show(block: ContentBlock) {
    const problems = landingProblems({blocks: [block]}, catalog);
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><PageBlockEditor eventID="e" coverImage="" block={block} index={0} count={1} values={{}} catalog={catalog} canEdit open error={problems[0]?.message} errors={Object.fromEntries(problems.filter(p => p.field).map(p => [p.field!, p.message]))} onSelect={() => {}} onUpdate={() => {}} onMove={() => {}} onDelete={() => {}} /></QueryClientProvider>);
    return problems;
}
function described(control: HTMLElement) {
    const id = control.getAttribute("aria-describedby");
    expect(control.getAttribute("aria-invalid")).toBe("true");
    expect(id).toBeTruthy();
    expect(document.getElementById(id!)?.textContent).toBeTruthy();
}
describe("nested content field validation", () => {
    it("keeps every invalid row and both fields rather than pointing all errors at the first item", () => {
        const problems = landingProblems({blocks: [{id: "facts", type: "facts", items: [{label: "", value: ""}, {label: "", value: ""}]}]}, []);
        expect(problems.map(p => p.field)).toEqual(["item:0:label", "item:0:value", "item:1:label", "item:1:value"]);
    });
    it("associates partner name and link errors with their own inputs", () => {
        const problems = show({id: "partners", type: "partners", groups: [{title: "{{nope}}", items: [{name: "", imageURL: "/logo.png", href: "javascript:bad"}, {name: "", imageURL: "/logo.png"}]}]});
        expect(problems.map(p => p.field)).toEqual(["group:0:title", "group:0:logo:0:name", "group:0:logo:0:href", "group:0:logo:1:name"]);
        for (const input of screen.getAllByRole("textbox").filter(el => el.getAttribute("aria-invalid") === "true")) described(input);
        expect(screen.getAllByRole("textbox").filter(el => el.getAttribute("aria-invalid") === "true")).toHaveLength(4);
        expect(document.querySelector(".event-content-editor__block-error")).toBeNull();
    });
    it("puts a missing variable at the text source and condition failures at their own rule controls", () => {
        const problems = show({id: "section", type: "section", label: "{{unknown}}", variables: [{name: "event.count", format: "number"}], visibility: [{variable: "event.count", operator: "equals", value: "bad"}, {variable: "missing", operator: "equals", value: 1}]});
        expect(problems.map(p => p.field)).toEqual(["label", "rule:0:value", "rule:1:variable"]);
        described(screen.getByRole("textbox", {name: "Заголовок розділу"}));
        const invalidGroups = [...document.querySelectorAll<HTMLElement>('[role="group"][aria-invalid="true"]')];
        expect(invalidGroups).toHaveLength(2);
        invalidGroups.forEach(described);
        expect(document.querySelector(".event-content-editor__block-error")).toBeNull();
    });
});
