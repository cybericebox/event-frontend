import {isValidElement,type ReactNode} from "react";
import {afterEach,expect,it,vi} from "vitest";
const server=vi.hoisted(()=>({path:"/rules",claims:{exp:60},context:vi.fn(async()=>({claims:{exp:60}})),manifest:vi.fn(async(slug="")=>({Audience:"staff",Revision:slug ? "rules-r2":"landing-r1"}))}));
vi.mock("next/headers",()=>({headers:async()=>new Headers({"x-event-pathname":server.path})}));
vi.mock("geist/font/sans",()=>({GeistSans:{variable:"sans"}}));
vi.mock("geist/font/mono",()=>({GeistMono:{variable:"mono"}}));
vi.mock("@/api/publicEventInfo",()=>({getPublicEventInfo:async()=>({EventID:"event",Name:"private",Theme:{Brand:"#123456"}}),PublicEventError:class extends Error{}}));
vi.mock("@/api/commonPage",()=>({getCommonManifest:server.manifest,readContext:server.context,RenderReadError:class extends Error{}}));
import RootLayout from "./layout";
import {EventReadSession} from "@/components/event/common/EventReadSession";
function sessionProps(node:ReactNode):Record<string,unknown>|undefined {
    if(!isValidElement<{children?:ReactNode}>(node))return;
    if(node.type===EventReadSession)return node.props as Record<string,unknown>;
    for(const child of [node.props.children].flat(Infinity) as ReactNode[]) {
        const props=sessionProps(child);if(props)return props;
    }
}
afterEach(()=>{server.path="/rules";vi.clearAllMocks();});
it("supplies the active custom-page revision rather than the landing revision",async()=>{
    const props=sessionProps(await RootLayout({children:<main />}));
    expect(props).toMatchObject({serverPath:"/rules",revision:"rules-r2",hasGrant:true,expiresAt:60,publicEvent:false});
});
it("keeps the coordinator inactive without token verification on a personal-route hard entry",async()=>{
    server.path="/manage";
    const props=sessionProps(await RootLayout({children:<main />}));
    expect(props).toMatchObject({serverPath:"/manage",revision:null,hasGrant:false,expiresAt:undefined});
    expect(server.context).not.toHaveBeenCalled();
});
