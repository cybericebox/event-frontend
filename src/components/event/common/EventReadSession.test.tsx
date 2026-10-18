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
    it.each([[true,false,3],[false,false,0],[false,true,0]])("revision polling %#: grant %s, public %s -> every %i s (0 = none)",async(hasGrant,publicEvent,seconds)=>{
        vi.useFakeTimers();const fetcher=browser();
        render(<EventReadSession hasGrant={hasGrant} expiresAt={hasGrant ? Math.floor(Date.now()/1000)+600:undefined} serverPath="/" revision="r1" publicEvent={publicEvent} />);
        const revisions=()=>fetcher.mock.calls.filter(([url])=>String(url).includes("/revision")).length;
        if(seconds===0) {
            await act(async()=>{await vi.advanceTimersByTimeAsync(600_000);});
            expect(revisions()).toBe(0);
            return;
        }
        await act(async()=>{await vi.advanceTimersByTimeAsync(seconds*1000-100);});
        expect(revisions()).toBe(0);
        await act(async()=>{await vi.advanceTimersByTimeAsync(100);});
        expect(revisions()).toBe(1);
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

function grantResponses(reply:()=>Response|Promise<Response>) {
    const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
        if(String(input).includes("/revision"))return new Response(null,{status:404});
        if(String(input).endsWith("/challenge"))return Response.json({Challenge:"challenge"});
        if(String(input).endsWith("/render-grant"))return reply();
        if(init?.method==="POST")return Response.json({ExpiresAt:Math.floor(Date.now()/1000)+60});
        return new Response(null,{status:204});
    });
    vi.stubGlobal("fetch",fetcher);return fetcher;
}
function grantCalls(fetcher:ReturnType<typeof grantResponses>) {
    return fetcher.mock.calls.filter(([url])=>String(url).endsWith("/render-grant"));
}
describe("grant retry admission",()=>{
    it("makes one anonymous 401 attempt in an open minute, then retries on explicit focus",async()=>{
        vi.useFakeTimers();const fetcher=grantResponses(()=>new Response(null,{status:401}));
        render(<EventReadSession hasGrant={false} serverPath="/" revision={null} publicEvent={false} />);
        await act(async()=>{await vi.advanceTimersByTimeAsync(60_000);});
        expect(grantCalls(fetcher)).toHaveLength(1);
        expect(fetcher.mock.calls.filter(([url])=>String(url).includes("/revision")).length).toBe(0);
        await act(async()=>{window.dispatchEvent(new Event("focus"));});
        expect(grantCalls(fetcher)).toHaveLength(2);
    });
    it("clears a failed 401 renewal exactly once and stops timer retries",async()=>{
        vi.useFakeTimers();const fetcher=grantResponses(()=>new Response(null,{status:401}));
        const view=render(<EventReadSession hasGrant expiresAt={Math.floor(Date.now()/1000)+60} serverPath="/" revision="r1" publicEvent={false} />);
        await act(async()=>{await vi.advanceTimersByTimeAsync(45_000);});
        view.rerender(<EventReadSession hasGrant={false} serverPath="/" revision={null} publicEvent={false} />);
        await act(async()=>{await vi.advanceTimersByTimeAsync(60_000);});
        expect(grantCalls(fetcher)).toHaveLength(1);
        expect(fetcher.mock.calls.filter(([,init])=>init?.method==="DELETE")).toHaveLength(1);
    });
    it.each([403,404])("restrains status %s retries while still discovering new staff entitlement",async status=>{
        vi.useFakeTimers();let allowed=false;
        const fetcher=grantResponses(()=>allowed ? Response.json({Data:{Token:"new-staff-grant"}}):new Response(null,{status}));
        render(<EventReadSession hasGrant={false} serverPath="/" revision={null} publicEvent={false} />);
        await act(async()=>{await vi.advanceTimersByTimeAsync(39_999);});expect(grantCalls(fetcher)).toHaveLength(1);
        allowed=true;
        await act(async()=>{await vi.advanceTimersByTimeAsync(1);});expect(grantCalls(fetcher)).toHaveLength(2);
        expect(fetcher.mock.calls.some(([url,init])=>String(url)==="/api/event-session" && init?.method==="POST" && JSON.parse(String(init.body)).Token==="new-staff-grant")).toBe(true);
        expect(navigation.router.refresh).toHaveBeenCalledTimes(1);
    });
    it("backs off repeated network failures from five seconds to a forty-second cap",async()=>{
        vi.useFakeTimers();const fetcher=grantResponses(()=>Promise.reject(new TypeError("offline")));
        render(<EventReadSession hasGrant={false} serverPath="/" revision={null} publicEvent={false} />);
        await act(async()=>{await vi.advanceTimersByTimeAsync(34_999);});expect(grantCalls(fetcher)).toHaveLength(3);
        await act(async()=>{await vi.advanceTimersByTimeAsync(1);});expect(grantCalls(fetcher)).toHaveLength(4);
        await act(async()=>{await vi.advanceTimersByTimeAsync(39_999);});expect(grantCalls(fetcher)).toHaveLength(4);
        await act(async()=>{await vi.advanceTimersByTimeAsync(1);});expect(grantCalls(fetcher)).toHaveLength(5);
    });
});

it("renews an existing grant without refreshing unchanged page content",async()=>{
    vi.useFakeTimers();
    const fetcher=browser();
    fetcher.mockImplementation(async(input,init)=>{
        if(String(input).includes("/revision"))return Response.json({Revision:"r1"});
        if(String(input).endsWith("/challenge"))return Response.json({Challenge:"challenge"});
        if(String(input).endsWith("/render-grant"))return Response.json({Data:{Token:"renewed"}});
        if(init?.method==="POST")return Response.json({ExpiresAt:Math.floor(Date.now()/1000)+60});
        return new Response(null,{status:204});
    });
    render(<EventReadSession hasGrant expiresAt={Math.floor(Date.now()/1000)+60} serverPath="/" revision="r1" publicEvent={false} />);
    await act(async()=>{await vi.advanceTimersByTimeAsync(45_000);});
    expect(fetcher.mock.calls.some(([url])=>String(url).endsWith("/render-grant"))).toBe(true);
    expect(navigation.router.refresh).not.toHaveBeenCalled();
});
