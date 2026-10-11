// @vitest-environment jsdom
import {act, cleanup, renderHook} from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {ManualDraftProvider} from "./manualDraft";
import {useBrandDraft} from "./BrandDraftField";
const api = vi.hoisted(() => ({upload: vi.fn(async () => "file-a")}));
vi.mock("@/api/manage", async original => ({...(await original() as object), uploadManageBrandDraft: api.upload}));
vi.mock("next/navigation", () => ({usePathname: () => "/manage/appearance", useRouter: () => ({push: vi.fn(), replace: vi.fn()})}));
beforeEach(() => {sessionStorage.clear(); vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:temporary"); vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);});
afterEach(() => {cleanup(); vi.restoreAllMocks();});
const wrapper = ({children}: {children: React.ReactNode}) => <ManualDraftProvider userID="user-a" eventID="event-a">{children}</ManualDraftProvider>;
const run = () => renderHook(() => useBrandDraft("event-a", "logo", "", 2 << 20), {wrapper});

describe("brand upload draft recovery", () => {
    it("restores server file references without storing binary or blob URLs", async () => {
        const first = run(); await act(async () => {await first.result.current.select(new File(["image"], "logo.png", {type: "image/png"}));});
        expect(Object.values(sessionStorage).join()).not.toContain("blob:"); first.unmount(); const restored = run();
        expect(restored.result.current.change).toEqual({Action: "replace", FileID: "file-a"}); expect(restored.result.current.dirty).toBe(true);
    });
    it("retains expired upload intent and asks to attach it again", async () => {
        const first = run(); await act(async () => {await first.result.current.select(new File(["image"], "logo.png", {type: "image/png"}));}); first.unmount();
        vi.spyOn(Date, "now").mockReturnValue(Date.now() + 25 * 60 * 60 * 1000);
        const restored = run(); expect(restored.result.current.change).toEqual({Action: "replace", FileID: "file-a"}); expect(restored.result.current.expired).toBe(true); expect(restored.result.current.error).not.toBe("");
    });
});
