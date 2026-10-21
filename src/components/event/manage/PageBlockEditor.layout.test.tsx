// @vitest-environment jsdom
import {useState} from "react";
import {afterEach,expect,it,vi} from "vitest";
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import {QueryClient,QueryClientProvider} from "@tanstack/react-query";
import {PageBlockEditor} from "./PageBlockEditor";
import {ContentBlocks} from "../content/ContentBlocks";
import type {ContentBlock} from "@/types/eventContent";
vi.mock("@/api/manage",async original=>({...await original<typeof import("@/api/manage")>(),getManagePages:vi.fn(async()=>[]),getManageContent:vi.fn(async()=>({})),uploadManageBannerImage:vi.fn()}));
afterEach(cleanup);
function Editor({canEdit=true}:{canEdit?:boolean}){
 const [block,setBlock]=useState<ContentBlock>({id:"banner",type:"banner",title:"CTF"});
 return <QueryClientProvider client={new QueryClient()}><PageBlockEditor eventID="e" coverImage="" block={block} index={0} count={1} values={{}} catalog={[]} canEdit={canEdit} selected onSelect={()=>{}} onUpdate={setBlock} onMove={()=>{}} onDelete={()=>{}}/><ContentBlocks document={{blocks:[block]}} variables={{}} preview /></QueryClientProvider>;
}
it("edits independent responsive spacing, preserves zero and resets to inherited values",()=>{
 const {container}=render(<Editor/>);
 fireEvent.click(screen.getByText("Відступи й ширина"));
 const desktop=screen.getByRole('spinbutton',{name:'Верхній відступ — компʼютер'});
 const mobile=screen.getByRole('spinbutton',{name:'Верхній відступ — телефон'});
 fireEvent.change(desktop,{target:{value:'24'}});fireEvent.change(mobile,{target:{value:'0'}});
 const block=container.querySelector('#banner') as HTMLElement;
 expect(block.style.getPropertyValue('--ib-spacing-desktop-top')).toBe('24px');
 expect(block.style.getPropertyValue('--ib-spacing-mobile-top')).toBe('0px');
 fireEvent.change(mobile,{target:{value:''}});
 expect(block.style.getPropertyValue('--ib-spacing-mobile-top')).toBe('');
 expect(block.style.getPropertyValue('--ib-spacing-desktop-top')).toBe('24px');
});
it("identifies invalid spacing beside the input and disables layout controls for viewers",()=>{
 render(<Editor/>);fireEvent.click(screen.getByText('Відступи й ширина'));
 const input=screen.getByRole('spinbutton',{name:'Верхній відступ — телефон'});
 fireEvent.change(input,{target:{value:'200'}});
 expect(input.getAttribute('aria-invalid')).toBe('true');
 expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toContain('160');
 cleanup();render(<Editor canEdit={false}/>);fireEvent.click(screen.getByText('Відступи й ширина'));
 expect((screen.getByRole('spinbutton',{name:'Верхній відступ — телефон'}) as HTMLInputElement).disabled).toBe(true);
});
