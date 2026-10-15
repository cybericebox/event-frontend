// @vitest-environment jsdom
import {act,cleanup,render,screen} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {afterEach,expect,it,vi} from "vitest";
vi.mock("next/navigation",()=>({usePathname:()=>"/",useRouter:()=>({refresh:vi.fn()})}));
vi.mock("./EventBrandLogo",()=>({EventBrandLogo:()=>null,EventBrandProvider:({children}:{children:React.ReactNode})=>children,useEventBrandName:()=>"",useEventBrandLogo:()=>""}));
vi.mock("./GuestShell",()=>({GuestShell:({children}:{children:React.ReactNode})=><>{children}</>}));
vi.mock("./ParticipantShell",()=>({ParticipantShell:({children}:{children:React.ReactNode})=><>{children}</>}));
vi.mock("./manage/ManagerShell",()=>({ManagerShell:({children}:{children:React.ReactNode})=><>{children}</>}));
vi.mock("./manage/ManagerBootstrap",()=>({ManagerBootstrap:({children}:{children:React.ReactNode})=><>{children}</>}));
vi.mock("./common/CommonPageWatcher",()=>({CommonPageWatcher:()=>null}));
import {AppShell} from "./AppShell";
import {EventReadSession} from "./common/EventReadSession";
import {trackApiFetch,reportServiceAvailable} from "@/utils/serviceStatus";
import {resetEventGone} from "@/utils/eventGone";
afterEach(()=>{cleanup();vi.useRealTimers();vi.unstubAllGlobals();reportServiceAvailable();resetEventGone();});
it("keeps a legacy neutral CORS fallback free of the outage overlay for 30 seconds and recovers on a fresh readable manifest",async()=>{
    vi.useFakeTimers();
    let readable=false;
    vi.stubGlobal("fetch",trackApiFetch(async(_input,init)=>{
        if(init?.mode==="no-cors")return new Response(null);
        if(readable)return new Response(null,{status:401});
        throw new TypeError("Failed to fetch");
    }));
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    const page=(revision:string|null)=><QueryClientProvider client={client}>
        <AppShell event={revision ? {EventID:"event-1"} as never:null} unavailable={false}><main>Published again</main></AppShell>
        <EventReadSession hasGrant={false} publicEvent revision={revision} serverPath="/" />
    </QueryClientProvider>;
    const view=render(page(null));
    for(let i=0;i<4;i++)await act(async()=>{await vi.advanceTimersByTimeAsync(50);});
    expect(screen.getByRole("heading",{name:"Захід не знайдено або у вас немає доступу"})).toBeTruthy();
    await act(async()=>{await vi.advanceTimersByTimeAsync(30_100);});
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByText("Published again")).toBeNull();
    readable=true;view.rerender(page("r2"));
    expect(screen.getByText("Published again")).toBeTruthy();
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("heading",{name:"Захід не знайдено або у вас немає доступу"})).toBeNull();
});
