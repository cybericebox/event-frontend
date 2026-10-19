// @vitest-environment jsdom
import {afterEach, expect, it} from "vitest";
import {cleanup, render} from "@testing-library/react";
import {QueryClient, QueryClientProvider} from "@tanstack/react-query";
import {ContentBlocks} from "./ContentBlocks";
import type {ContentBlock} from "@/types/eventContent";
afterEach(cleanup);
it("applies layout to regular and specialized blocks without adding layout wrappers", () => {
 const common={spacing:{desktop:{top:0,bottom:12},mobile:{inline:0}},maxWidth:960,contentAlign:"center" as const};
 const blocks:ContentBlock[]=[{id:"banner",type:"banner",mobileFullWidth:true}, {id:"text",type:"text",textColumns:2}, {id:"action",type:"cta",action:{label:"Rules",href:"/rules"}}, {id:"partners",type:"partners",groups:[]}].map(b=>({...b,...common})) as ContentBlock[];
 const {container}=render(<QueryClientProvider client={new QueryClient()}><ContentBlocks document={{blocks}} variables={{}} preview previewViewer="guest" /></QueryClientProvider>);
 for(const id of ["banner","text","action","partners"]){
  const root=container.querySelector(`#${id}`) as HTMLElement;
  expect(root.style.getPropertyValue("--ib-spacing-desktop-top")).toBe("0px");
  expect(root.style.getPropertyValue("--ib-content-max")).toBe("960px");
  expect(root.dataset.contentAlign).toBe("center");
  expect(root.parentElement?.className).toBe("ib-blocks");
 }
 expect(container.querySelector('#banner')?.getAttribute('data-mobile-full-width')).toBe('true');
 expect(container.querySelector('#text')?.getAttribute('data-text-columns')).toBe('2');
});
it("does not introduce layout overrides on legacy blocks",()=>{
 const {container}=render(<ContentBlocks document={{blocks:[{id:"old",type:"banner"}]}} variables={{}} />);
 expect(container.querySelector('#old')?.getAttribute('style')).toBeNull();
});
it("provides a size-query container around constrained content so narrow blocks adapt independently",()=>{
 const {container}=render(<ContentBlocks document={{blocks:[{id:'doc',type:'doc',maxWidth:320,items:[]},{id:'text',type:'text',maxWidth:320,textColumns:2}]}} variables={{}} />);
 for(const id of ['doc','text'])expect(container.querySelector(`#${id} > .ib-block-width > .ib-block__in`)).not.toBeNull();
});
