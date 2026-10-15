// @vitest-environment jsdom
import {cleanup,render,act} from "@testing-library/react";
import {afterEach,expect,it,vi} from "vitest";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {LiveContentBlocks} from "./LiveContentBlocks";
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();});
it("renders each new publication with its own variables before a live-count poll, without remounting",async()=>{
    vi.useFakeTimers();
    const fetcher=vi.fn().mockResolvedValue(Response.json({Variables:{"event.name":"r2 title","event.participants":99}}));vi.stubGlobal("fetch",fetcher);
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    const document={blocks:[{id:"title",type:"text" as const,richText:{root:{type:"root" as const,children:[{type:"paragraph",children:[{type:"variable",varName:"event.name"},{type:"text",text:" / "},{type:"variable",varName:"event.participants"}]}]}}}]};
    const page=(revision:string,name:string,count:number)=><QueryClientProvider client={client}><LiveContentBlocks eventID="event" document={document} initialVariables={{"event.name":name,"event.participants":count}} revision={revision} /></QueryClientProvider>;
    const view=render(page("r1","r1 title",10));expect(view.container.textContent).toBe("r1 title / 10");
    view.rerender(page("r2","r2 title",20));expect(view.container.textContent).toBe("r2 title / 20");
    expect(fetcher).not.toHaveBeenCalled();
    await act(async()=>{await vi.advanceTimersByTimeAsync(60_000);});
    await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
    expect(view.container.textContent).toBe("r2 title / 99");
});
