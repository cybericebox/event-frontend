// @vitest-environment jsdom
import {cleanup,render,act} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {LiveContentBlocks} from "./LiveContentBlocks";
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
it("applies a newly rendered server clock without retaining an older lifecycle phase",()=>{
    vi.useFakeTimers();
    const first=Date.parse("2026-10-16T10:00:00Z");
    vi.setSystemTime(first);
    const client=new QueryClient();
    const document={blocks:[{id:"phase",type:"text" as const,richText:{root:{type:"root" as const,children:[{type:"paragraph",children:[{type:"variable",varName:"event.phase"}]}]}}}]};
    const page=(initialNow:number)=><QueryClientProvider client={client}><LiveContentBlocks initialNow={initialNow} eventID="event" document={document} revision="r1" initialVariables={{"event.phase":"published","event.startAt":new Date(first+1000).toISOString()}} /></QueryClientProvider>;
    const view=render(page(first));
    expect(view.container.textContent).toBe("published");
    vi.setSystemTime(first+5000);
    view.rerender(page(first+5000));
    expect(view.container.textContent).toBe("started");
});
it("renders each new publication with its own variables before a live-count poll, without remounting",async()=>{
    vi.useFakeTimers();
    const fetcher=vi.fn().mockResolvedValue(Response.json({Revision:"r2",Variables:{"event.name":"r2 title","event.participantCount":99}}));vi.stubGlobal("fetch",fetcher);
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    const document={blocks:[{id:"title",type:"text" as const,richText:{root:{type:"root" as const,children:[{type:"paragraph",children:[{type:"variable",varName:"event.name"},{type:"text",text:" / "},{type:"variable",varName:"event.participantCount"}]}]}}}]};
    const page=(revision:string,name:string,count:number)=><QueryClientProvider client={client}><LiveContentBlocks initialNow={Date.now()} eventID="event" document={document} initialVariables={{"event.name":name,"event.participantCount":count}} revision={revision} /></QueryClientProvider>;
    const view=render(page("r1","r1 title",10));expect(view.container.textContent).toBe("r1 title / 10");
    view.rerender(page("r2","r2 title",20));expect(view.container.textContent).toBe("r2 title / 20");
    expect(fetcher).not.toHaveBeenCalled();
    await act(async()=>{await vi.advanceTimersByTimeAsync(60_000);});
    await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
    expect(view.container.textContent).toBe("r2 title / 99");
});

it.each(["r1","other"])("keeps timer, image and registration source on live poll revision %s", async revision=>{
    vi.useFakeTimers();
    const start="2026-10-26T12:00:00Z";
    const fetcher=vi.fn().mockResolvedValue(Response.json({Revision:revision,Variables:{"event.startAt":"2026-10-27T12:00:00Z","event.registrationOpen":false,"event.participantCount":100}}));
    vi.stubGlobal("fetch",fetcher);
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    const document={blocks:[{id:"banner",type:"banner" as const,imageSource:"custom",imageURL:"/banner.png"},{id:"timer",type:"countdown" as const,targetVariable:"event.startAt"},{id:"source",type:"text" as const,richText:{root:{type:"root" as const,children:[{type:"paragraph",children:[{type:"variable",varName:"event.startAt"},{type:"text",text:" / "},{type:"variable",varName:"event.registrationOpen"},{type:"variable",varName:"event.participantCount"}]}]}}}]};
    const view=render(<QueryClientProvider client={client}><LiveContentBlocks initialNow={Date.now()} eventID="event" document={document} revision="r1" initialVariables={{"event.startAt":start,"event.registrationOpen":true}} /></QueryClientProvider>);
    const timer=view.getByRole("timer"), image=view.container.querySelector("img");
    const source=view.container.querySelector(".ib-block-prose")!.textContent;
    await act(async()=>{await vi.advanceTimersByTimeAsync(60_001);});
    expect(view.getByRole("timer")).toBe(timer);
    expect(view.container.querySelector("img")).toBe(image);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(view.container.querySelector(".ib-block-prose")!.textContent).toBe(revision === "r1" ? source!.replace(/—$/, "100") : source);
});

it("does not poll values for a page that only has source data and a local countdown",async()=>{
    vi.useFakeTimers();
    const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);
    const client=new QueryClient();
    const document={blocks:[{id:"timer",type:"countdown" as const,targetVariable:"event.startAt"}]};
    render(<QueryClientProvider client={client}><LiveContentBlocks initialNow={Date.now()} eventID="event" document={document} revision="r1" initialVariables={{"event.startAt":"2026-10-26T12:00:00Z"}} /></QueryClientProvider>);
    await act(async()=>{await vi.advanceTimersByTimeAsync(120_001);});
    expect(fetcher).not.toHaveBeenCalled();
});
