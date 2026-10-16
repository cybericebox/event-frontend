// @vitest-environment jsdom
import {afterEach, expect, it, vi} from "vitest";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {LiveLogosEditor} from "./LiveLogosEditor";
import {uploadLiveLogo} from "@/api/manageLive";

vi.mock("@/api/manageLive", async original => ({...await original<typeof import("@/api/manageLive")>(), uploadLiveLogo: vi.fn(async () => {throw new Error("offline");})}));
afterEach(() => {cleanup(); vi.clearAllMocks();});

it("keeps a dark-logo upload failure beside the row that selected it", async () => {
    const {container} = render(<LiveLogosEditor eventID="e" items={[{src: "/api/media/first.svg"}, {src: "/api/media/second.svg"}]} disabled={false} onChange={vi.fn()} />);
    fireEvent.change(container.querySelector('input[type="file"][hidden]')!, {target: {files: [new File(["x"], "dark.svg", {type: "image/svg+xml"})]}});
    expect(uploadLiveLogo).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", {name: /Додати.*темн/i})[1]);
    fireEvent.change(container.querySelector('input[type="file"][hidden]')!, {target: {files: [new File(["x"], "dark.svg", {type: "image/svg+xml"})]}});
    const issue = await screen.findByRole("alert");
    const row = issue.closest("li")!;
    expect(row).toBeTruthy();
    expect(row.getAttribute("aria-invalid")).toBe("true");
    expect(row.getAttribute("aria-describedby")).toBe(issue.id);
    expect(container.querySelector(".event-file-picker")?.contains(issue)).toBe(false);
});
