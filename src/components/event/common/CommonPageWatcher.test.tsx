// @vitest-environment jsdom
import {act,render,cleanup} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
const refresh=vi.hoisted(()=>vi.fn());
vi.mock("next/navigation",()=>({useRouter:()=>({refresh})}));
import {getServiceStatus,reportServiceAvailable} from "@/utils/serviceStatus";
import {CommonPageWatcher} from "./CommonPageWatcher";
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();reportServiceAvailable();});
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

it("keeps a neutral tab watching until a readable publication appears",async()=>{
    vi.useFakeTimers();
    const fetcher=vi.fn().mockResolvedValueOnce(new Response(null,{status:404})).mockResolvedValueOnce(Response.json({Revision:"r1"}));
    vi.stubGlobal("fetch",fetcher);
    render(<CommonPageWatcher revision={null} />);
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});expect(refresh).not.toHaveBeenCalled();
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});expect(refresh).toHaveBeenCalledTimes(1);
});
it.each(["network","503"])("feeds local revision %s failures into the outage grace policy",async failure=>{
    vi.useFakeTimers();
    vi.stubGlobal("fetch",failure==="network" ? vi.fn().mockRejectedValue(new TypeError("offline")):vi.fn().mockResolvedValue(new Response(null,{status:503})));
    render(<CommonPageWatcher revision="r1" />);
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});
    expect(getServiceStatus()).toBe("suspect");expect(refresh).not.toHaveBeenCalled();
});
it("continues watching after readable, denied, and readable server verdicts in one mount",async()=>{
    vi.useFakeTimers();
    vi.stubGlobal("fetch",vi.fn().mockResolvedValueOnce(new Response(null,{status:404})).mockResolvedValueOnce(new Response(null,{status:404})).mockResolvedValueOnce(Response.json({Revision:"r2"})));
    const view=render(<CommonPageWatcher revision="r1" />);
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});expect(refresh).toHaveBeenCalledTimes(1);
    view.rerender(<CommonPageWatcher revision={null} />);
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});expect(refresh).toHaveBeenCalledTimes(1);
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000);});expect(refresh).toHaveBeenCalledTimes(2);
});
