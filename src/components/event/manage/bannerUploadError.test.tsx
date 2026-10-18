// @vitest-environment jsdom
import {afterEach, describe, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen, waitFor} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {PageBlockEditor} from "./PageBlockEditor";
import {landingProblems} from "./validatePageBlocks";
import {uploadManageBannerImage} from "@/api/manage";
import {ApiErrorCode, apiErrorMessage} from "@/api/apiErrors";
import type {ContentBlock} from "@/types/eventContent";

vi.mock("@/api/manage", () => ({getManagePages: vi.fn(async () => []), getManageContent: vi.fn(async () => ({})), uploadManageBannerImage: vi.fn()}));
afterEach(cleanup);

const block: ContentBlock = {id: "banner", type: "banner", imageSource: "custom", imageURL: ""};

describe("banner picture field", () => {
    it("shows only the upload error, not the required error, after a failed upload", async () => {
        vi.mocked(uploadManageBannerImage).mockRejectedValue({code: ApiErrorCode.ImageTooManyPixels});
        const problems = landingProblems({blocks: [block]}, []);
        render(<QueryClientProvider client={new QueryClient({defaultOptions: {queries: {retry: false}}})}><PageBlockEditor eventID="e" coverImage="" block={block} index={0} count={1} values={{}} catalog={[]} canEdit open
            error={problems[0]?.message} errors={Object.fromEntries(problems.filter(p => p.field).map(p => [p.field!, p.message]))} onSelect={() => {}} onUpdate={() => {}} onMove={() => {}} onDelete={() => {}} /></QueryClientProvider>);
        const group = screen.getByRole("group", {name: "Окреме зображення"});
        expect(group.querySelectorAll('[role="alert"]')).toHaveLength(1);
        const input = group.querySelector<HTMLInputElement>('input[type="file"]')!;
        fireEvent.change(input, {target: {files: [new File(["x"], "banner.webp", {type: "image/webp"})]}});
        await waitFor(() => expect(group.querySelector('[role="alert"]')?.textContent).toBe(apiErrorMessage(ApiErrorCode.ImageTooManyPixels, "")));
        expect(group.querySelectorAll('[role="alert"]')).toHaveLength(1);
        expect(group.getAttribute("aria-invalid")).toBe("true");
    });
});
