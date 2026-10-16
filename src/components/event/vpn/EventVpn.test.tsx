// @vitest-environment jsdom
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
const api=vi.hoisted(()=>({stand:vi.fn(),probe:vi.fn(),config:vi.fn(),preview:false,previewBoard:vi.fn(),previewLab:vi.fn(),previewConfig:vi.fn()}));
vi.mock("@/api/manageLabs",async importOriginal=>({...await importOriginal<typeof import("@/api/manageLabs")>(),getOwnStandStatus:api.stand,getManageLabs:vi.fn(),getModeratorVPNConfig:api.config}));
vi.mock("@/api/vpn",()=>({getVPNStatus:api.probe,issueVPNConfig:api.config,VPNApiError:class extends Error{}}));
vi.mock("@/components/event/ParticipantPreview",()=>({useParticipantPreview:()=>({active:api.preview})}));
vi.mock("@/utils/origins",()=>({wireguardInstallUrl:"https://www.wireguard.com/install/"}));
vi.mock("@/api/participantPreview",()=>({getPreviewBoard:api.previewBoard,getPreviewLab:api.previewLab,getPreviewVPNConfig:api.previewConfig,previewBoardKey:(eventID:string)=>["event-participant-preview-board",eventID]}));
import {EventVpnProvider,VpnHeaderButton} from "./EventVpn";
beforeEach(()=>{api.preview=false;api.stand.mockReset();api.previewBoard.mockReset();api.previewLab.mockReset();api.previewConfig.mockReset();api.previewBoard.mockResolvedValue({Challenges:[]});api.probe.mockReset();HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};api.probe.mockResolvedValue({GatewayIP:"10.8.0.1",ProbeURL:"http://10.8.0.1:8088/"});api.config.mockReset();});
afterEach(cleanup);
it.each([{Status:"not_deployed",VPNReady:false},{Status:"creating",VPNReady:true},{Status:"ready",VPNReady:false}])("gates downloads by VPN group readiness, independently of lab state %j",async status=>{
 api.stand.mockResolvedValue(status);
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><EventVpnProvider eventID="e1" eventTag="test" enabled><VpnHeaderButton/></EventVpnProvider></QueryClientProvider>);
 await vi.waitFor(()=>expect(client.getQueryData(["event-own-stand","e1"])).toEqual(status));
 fireEvent.click(screen.getByRole("button",{name:/VPN:/}));
 if(status.VPNReady){expect(await screen.findByRole("button",{name:"Завантажити файл"})).toBeTruthy();expect(await screen.findByRole("link",{name:/Перевірте зʼєднання/})).toBeTruthy();expect(screen.getByText("ping 10.8.0.1")).toBeTruthy();}
 else{expect(screen.queryByRole("button",{name:"Завантажити файл"})).toBeNull();expect(api.config).not.toHaveBeenCalled();}
});

it.each([true,false,null])("colours the header only for the caller's connected peer: %s",async connected=>{
 api.stand.mockResolvedValue({Status:"ready",VPNReady:true});
 api.probe.mockResolvedValue({GatewayIP:"10.8.0.1",ProbeURL:"http://10.8.0.1:8088/",Connected:connected});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><EventVpnProvider eventID="e1" eventTag="test" enabled><VpnHeaderButton/></EventVpnProvider></QueryClientProvider>);
 await vi.waitFor(()=>expect(client.getQueryData(["event-vpn-status","e1",false])).toMatchObject({Connected:connected}));
 const header=screen.getByRole("button",{name:/VPN:/});
 expect(header.classList.contains("is-connected")).toBe(connected===true);
 expect(header.classList.contains("is-available")).toBe(connected!==true);
 fireEvent.click(header);
 expect(screen.queryByText("Лабораторії")).toBeNull();
 expect(screen.queryByText(/завдан/)).toBeNull();
 expect(screen.getByText(connected===true?"Підключено":connected===false?"Готовий до підключення":"VPN доступний")).toBeTruthy();
 const disclosure=screen.getByText("Інструкція").closest("details")!;
 expect(disclosure.open).toBe(connected!==true);
 expect(header.getAttribute("aria-label")).toContain(connected===true?"підключено":connected===false?"готовий":"невідомий");
});
it("explains preview VPN availability without promising an exact minute",async()=>{
 api.preview=true;
 api.previewBoard.mockResolvedValue({Challenges:[{PreviewDynamic:true,PreviewCanStart:true}]});
 api.stand.mockResolvedValue({Status:"not_deployed",VPNReady:false});
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 render(<QueryClientProvider client={client}><EventVpnProvider eventID="e1" eventTag="test" enabled><VpnHeaderButton/></EventVpnProvider></QueryClientProvider>);
 fireEvent.click(await screen.findByRole("button",{name:/VPN:/}));
 expect(await screen.findByText(/VPN стане доступним після запуску середовища завдання/)).toBeTruthy();
 expect(api.probe).not.toHaveBeenCalled();
 expect(api.stand).not.toHaveBeenCalled();
});
