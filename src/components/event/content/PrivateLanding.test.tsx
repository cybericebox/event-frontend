// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {plainTextRichText} from "./richTextState";
import {PrivateLanding} from "./PrivateLanding";

vi.mock("@/components/event/PrivateEventBootstrap", () => ({usePrivateEvent: () => ({EventID: "event-1", Name: "Подія", PreviewPicture: ""})}));
vi.mock("@/api/manage", () => ({getManageContent: vi.fn(() => new Promise(() => {}))}));

afterEach(cleanup);
describe("PrivateLanding", () => {
    it("shows the saved editor document immediately when navigating from management", () => {
        const client = new QueryClient({defaultOptions: {queries: {retry: false, staleTime: 60_000}}});
        client.setQueryData(["event-management-content", "event-1"], {
            Landing: {blocks: [{id: "saved", type: "text", richText: plainTextRichText("Збережений банер")}]}, Variables: {},
        });
        render(<QueryClientProvider client={client}><PrivateLanding /></QueryClientProvider>);
        expect(screen.getByText("Збережений банер")).toBeTruthy();
        expect(screen.queryByRole("status", {name: "Завантажуємо головну сторінку…"})).toBeNull();
    });
});
