// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, render, screen} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";

const EVENT_ID = "01a0d498-32b3-7a38-8355-30cc209f56ab";
vi.mock("next/navigation", () => ({useRouter: () => ({push: vi.fn(), replace: vi.fn()})}));
vi.mock("./ManagerShell", () => ({useManager: () => ({event: {EventID: EVENT_ID, Name: "CTF 2027", Participation: 0, LogoURL: null}, canManage: false})}));
vi.mock("@/utils/origins", async original => ({...(await original() as object), apiOrigin: "https://api.test", requireApiOrigin: () => "https://api.test"}));

import {CustomPageEditor} from "./PageContentEditor";

afterEach(cleanup);

describe("CustomPageEditor for a viewer", () => {
    it("shows the read-only state instead of an empty new-page form", () => {
        globalThis.fetch = vi.fn(async () => new Response("{}", {status: 404})) as typeof fetch;
        render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><CustomPageEditor /></QueryClientProvider>);
        expect(screen.getByText(/Створювати сторінки можуть власник заходу/)).toBeTruthy();
        expect(screen.queryByRole("button", {name: "Зберегти"})).toBeNull();
    });
});
