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
 // The cache fills before the header re-renders: wait for the rendered state, not only the data (flaky under load).
 await vi.waitFor(()=>{
  const button=screen.getByRole("button",{name:/VPN:/});
  expect(button.classList.contains("is-connected")).toBe(connected===true);
  expect(button.classList.contains("is-available")).toBe(connected!==true);
 });
 const header=screen.getByRole("button",{name:/VPN:/});
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


it.each([false,true])("uses the approved guide and matching config filename in participant preview=%s",async preview=>{
 api.preview=preview;
 api.stand.mockResolvedValue({Status:"ready",VPNReady:true});
 api.probe.mockResolvedValue({Connected:false});
 api.previewBoard.mockResolvedValue({Challenges:[{PreviewDynamic:true,PreviewRunID:"run1",PreviewSelectionID:"selection1"}]});
 api.previewLab.mockResolvedValue({Ready:true,VPNConnected:false});
 api.config.mockResolvedValue("[Interface]");
 api.previewConfig.mockResolvedValue("[Interface]");
 const objectURL=vi.fn(()=>"blob:config");
 const NativeURL=URL;
 vi.stubGlobal("URL",class extends NativeURL{static createObjectURL=objectURL;static revokeObjectURL=vi.fn();});
 const downloaded:string[]=[];
 const anchorClick=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(function(this:HTMLAnchorElement){downloaded.push(this.download);});
 try{
  const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
  render(<QueryClientProvider client={client}><EventVpnProvider eventID="e1" eventTag="autumnctf" enabled><VpnHeaderButton/></EventVpnProvider></QueryClientProvider>);
  await vi.waitFor(()=>expect(client.getQueryData(preview?["event-preview-vpn-lab","e1","selection1"]:["event-vpn-status","e1",false])).toBeTruthy());
  fireEvent.click(await screen.findByRole("button",{name:/VPN:/}));
  expect(screen.getByRole("link",{name:"WireGuard"}).getAttribute("href")).toBe("https://www.wireguard.com/install/");
  expect(screen.getByText("У застосунку")).toBeTruthy();
  expect(screen.getByText("Або через термінал")).toBeTruthy();
  expect(screen.getByText("sudo wg-quick up ./autumnctf.conf")).toBeTruthy();
  expect(screen.getByText("sudo wg-quick down ./autumnctf.conf")).toBeTruthy();
  expect(screen.queryByText(/pkill|ip link delete/)).toBeNull();
  expect(screen.getByText("Не забудьте вимкнути VPN, коли закінчите, і не видаляйте файл до цього.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Завантажити файл"}));
  await vi.waitFor(()=>expect(downloaded).toEqual(["autumnctf.conf"]));
  if(preview){expect(api.previewConfig).toHaveBeenCalledWith("e1","selection1");expect(api.config).not.toHaveBeenCalled();}
  else{expect(api.config).toHaveBeenCalledWith("e1");expect(api.previewConfig).not.toHaveBeenCalled();}
 }finally{anchorClick.mockRestore();vi.unstubAllGlobals();}
});
