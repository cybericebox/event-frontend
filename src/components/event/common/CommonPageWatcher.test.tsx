// @vitest-environment jsdom
import {act,render,cleanup} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
const refresh=vi.hoisted(()=>vi.fn());
vi.mock("next/navigation",()=>({useRouter:()=>({refresh})}));
import {CommonPageWatcher} from "./CommonPageWatcher";
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();});
describe("common publication watcher",()=>{
    it("refreshes only after the revision changes and stops on unmount",async()=>{
        vi.useFakeTimers();
        const fetcher=vi.fn().mockResolvedValueOnce(Response.json({Revision:"r1"})).mockResolvedValueOnce(Response.json({Revision:"r2"}));
        vi.stubGlobal("fetch",fetcher);
        const view=render(<CommonPageWatcher revision="r1" />);
        await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});expect(refresh).not.toHaveBeenCalled();
        await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});expect(refresh).toHaveBeenCalledTimes(1);
        view.unmount();await act(async()=>{await vi.advanceTimersByTimeAsync(4000);});expect(fetcher).toHaveBeenCalledTimes(2);
    });
    it("refreshes to the neutral screen on withdrawal",async()=>{
        vi.useFakeTimers();vi.stubGlobal("fetch",vi.fn().mockResolvedValue(new Response(null,{status:404})));
        render(<CommonPageWatcher revision="r1" />);
        await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});expect(refresh).toHaveBeenCalledTimes(1);
    });
});
