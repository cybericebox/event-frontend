// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {useState} from "react";

const getTags = vi.fn();
vi.mock("@/api/manageChallenges", () => ({getPublishedExerciseTags: (...args: unknown[]) => getTags(...args)}));
import {CatalogTagFilter} from "./CatalogTagFilter";

afterEach(() => {cleanup(); getTags.mockReset();});

function Harness({onChange}: {onChange: (value: string[]) => void}) {
    const [value, setValue] = useState<string[]>([]);
    return <CatalogTagFilter eventID="e1" enabled value={value} onChange={next => {setValue(next); onChange(next);}} />;
}

function setup() {
    const onChange = vi.fn();
    render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><Harness onChange={onChange} /></QueryClientProvider>);
    return onChange;
}

describe("CatalogTagFilter", () => {
    it("lists the most used tags on focus and toggles a tag into a removable chip", async () => {
        getTags.mockResolvedValue([{Tag: "web", ExerciseCount: 3}, {Tag: "pwn", ExerciseCount: 1}]);
        const onChange = setup();
        fireEvent.focus(screen.getByRole("combobox"));
        const option = await screen.findByRole("option", {name: /web/});
        expect(getTags).toHaveBeenCalledWith("e1", "", 50);
        fireEvent.pointerDown(option);
        expect(onChange).toHaveBeenLastCalledWith(["web"]);
        fireEvent.click(screen.getByRole("button", {name: "Прибрати тег web"}));
        expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it("searches suggestions by the typed prefix", async () => {
        getTags.mockResolvedValue([{Tag: "web", ExerciseCount: 3}]);
        setup();
        const input = screen.getByRole("combobox");
        fireEvent.focus(input);
        await screen.findByRole("option", {name: /web/});
        fireEvent.change(input, {target: {value: "pw"}});
        await waitFor(() => expect(getTags).toHaveBeenLastCalledWith("e1", "pw", 50));
    });

    it("shows the empty state and the any-tag hint", async () => {
        getTags.mockResolvedValue([]);
        setup();
        expect(screen.getByText("Показуємо завдання з будь-яким із вибраних тегів.")).toBeTruthy();
        fireEvent.focus(screen.getByRole("combobox"));
        expect(await screen.findByText("Тегів немає.")).toBeTruthy();
    });
});
