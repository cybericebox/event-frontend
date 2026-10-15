// @vitest-environment jsdom
import {act,render,cleanup} from "@testing-library/react";
import {afterEach,describe,expect,it,vi} from "vitest";
import {isEventGone,markEventGone,resetEventGone} from "@/utils/eventGone";
const navigation=vi.hoisted(()=>({pathname:"/",router:{refresh:vi.fn()}}));
vi.mock("next/navigation",()=>({useRouter:()=>navigation.router,usePathname:()=>navigation.pathname}));
import {EventReadSession} from "./EventReadSession";
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();vi.clearAllMocks();resetEventGone();navigation.pathname="/";});
function browser() {
    const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
        if(String(input).includes("/revision"))return new Response(null,{status:404});
        if(String(input).endsWith("/challenge"))return Response.json({Challenge:"challenge"});
        if(String(input).endsWith("/render-grant"))return Response.json({Data:{Token:"scoped"}});
        if(init?.method==="POST")return Response.json({Subject:"user",ExpiresAt:Math.floor(Date.now()/1000)+60});
        return new Response(null,{status:204});
    });
    vi.stubGlobal("fetch",fetcher);return fetcher;
}
describe("retained root common-session coordinator",()=>{
    it.each([false,true])("activates only on common navigation with existing grant %s",async hasGrant=>{
        vi.useFakeTimers();navigation.pathname="/manage";const fetcher=browser();
        const props={hasGrant,expiresAt:hasGrant ? Math.floor(Date.now()/1000)+60:undefined,serverPath:"/manage",revision:null,publicEvent:false};
        const view=render(<EventReadSession {...props} />);
        await act(async()=>{});expect(fetcher).not.toHaveBeenCalled();
        navigation.pathname="/";view.rerender(<EventReadSession {...props} />);await act(async()=>{});
        expect(navigation.router.refresh).toHaveBeenCalled();
        expect(fetcher.mock.calls.some(([url])=>String(url).endsWith("/render-grant"))).toBe(false);
        view.rerender(<EventReadSession {...props} serverPath="/" />);await act(async()=>{});
        expect(fetcher.mock.calls.some(([url])=>String(url).endsWith("/render-grant"))).toBe(!hasGrant);
        navigation.pathname="/challenges";view.rerender(<EventReadSession {...props} />);const count=fetcher.mock.calls.length;
        await act(async()=>{await vi.advanceTimersByTimeAsync(50_000);});expect(fetcher).toHaveBeenCalledTimes(count);
        navigation.pathname="/";view.rerender(<EventReadSession {...props} />);await act(async()=>{});
        expect(navigation.router.refresh.mock.calls.length).toBeGreaterThan(1);
    });
    it("uses the verified cookie on reload until fifteen seconds before expiry",async()=>{
        vi.useFakeTimers();const fetcher=browser();
        render(<EventReadSession hasGrant expiresAt={Math.floor(Date.now()/1000)+60} serverPath="/" revision="r1" publicEvent={false} />);
        await act(async()=>{await vi.advanceTimersByTimeAsync(44_000);});
        expect(fetcher.mock.calls.filter(([url])=>String(url).endsWith("/render-grant"))).toHaveLength(0);
        await act(async()=>{await vi.advanceTimersByTimeAsync(1000);});
        expect(fetcher.mock.calls.filter(([url])=>String(url).endsWith("/render-grant"))).toHaveLength(1);
    });
    it("never obtains a grant for known public common pages",async()=>{
        vi.useFakeTimers();const fetcher=browser();
        render(<EventReadSession hasGrant={false} serverPath="/" revision="r1" publicEvent />);
        await act(async()=>{await vi.advanceTimersByTimeAsync(50_000);});
        expect(fetcher.mock.calls.every(([url])=>String(url).includes("/revision"))).toBe(true);
    });
    it.each([false,true])("clears recoverable denial only after a fresh readable server verdict (grant %s)",async hasGrant=>{
        vi.useFakeTimers();browser();markEventGone();
        const view=render(<EventReadSession hasGrant={false} serverPath="/" revision={null} publicEvent={false} />);
        expect(isEventGone()).toBe(true);
        view.rerender(<EventReadSession hasGrant={hasGrant} expiresAt={hasGrant ? Math.floor(Date.now()/1000)+60:undefined} serverPath="/" revision="r2" publicEvent={!hasGrant} />);
        expect(isEventGone()).toBe(false);
    });
});
