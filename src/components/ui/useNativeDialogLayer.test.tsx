// @vitest-environment jsdom
import {afterEach, beforeAll, expect, it} from "vitest";
import {useEffect, useRef, useState} from "react";
import {cleanup, fireEvent, render, screen} from "@testing-library/react";
import {useNativeDialogLayer} from "./useNativeDialogLayer";

beforeAll(()=>{
 HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
 HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");this.dispatchEvent(new Event("close"));};
});
afterEach(()=>{cleanup();document.body.removeAttribute("style");document.body.removeAttribute("data-scroll-locked");document.documentElement.style.overflow="";});
function Modal({open,onClose,children}:{open:boolean;onClose:()=>void;children?:React.ReactNode}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(open)ref.current?.showModal();else ref.current?.close();},[open]);
 const release=useNativeDialogLayer(ref,open);
 return <dialog ref={ref} role="dialog" aria-modal="true" onClose={event=>{if(event.target!==ref.current)return;release();onClose();}}><button>First</button>{children}<button onClick={()=>ref.current?.close()}>Last</button></dialog>;
}
function Fixture(){const[open,setOpen]=useState(true);return <><button data-testid="background">Background</button><Modal open={open} onClose={()=>setOpen(false)}/></>;}
it("locks document scrolling, makes the background inert and restores exact prior attributes and styles",()=>{
 document.body.setAttribute("style","overflow: auto; padding-top: 7px;");document.documentElement.style.overflow="scroll";
 const view=render(<Fixture/>);const background=screen.getByTestId("background");
 expect(document.body.style.position).toBe("fixed");expect(document.documentElement.style.overflow).toBe("hidden");
 expect(document.body.hasAttribute("data-scroll-locked")).toBe(true);expect(background.hasAttribute("inert")).toBe(true);expect(background.getAttribute("aria-hidden")).toBe("true");
 fireEvent.click(screen.getByRole("button",{name:"Last"}));
 expect(document.body.getAttribute("style")).toBe("overflow: auto; padding-top: 7px;");expect(document.documentElement.style.overflow).toBe("scroll");expect(background.hasAttribute("inert")).toBe(false);expect(background.hasAttribute("aria-hidden")).toBe(false);
 view.unmount();
});
it("cycles keyboard focus inside the active dialog and redirects outside focus",()=>{
 render(<Fixture/>);const first=screen.getByRole("button",{name:"First"});const last=screen.getByRole("button",{name:"Last"});
 last.focus();fireEvent.keyDown(last,{key:"Tab"});expect(document.activeElement).toBe(first);
 fireEvent.keyDown(first,{key:"Tab",shiftKey:true});expect(document.activeElement).toBe(last);
 screen.getByTestId("background").focus();expect(document.activeElement).toBe(first);
});
it("nested dialogs retain the page lock until the final layer closes and cleanup restores pre-existing inert",()=>{
 function Nested(){const[open,setOpen]=useState(false);return <><button data-testid="outside" inert aria-hidden="true">Outside</button><Modal open onClose={()=>{}}><button onClick={()=>setOpen(true)}>Nested</button><Modal open={open} onClose={()=>setOpen(false)}/></Modal></>;}
 const view=render(<Nested/>);fireEvent.click(screen.getByRole("button",{name:"Nested"}));
 const dialogs=screen.getAllByRole("dialog");expect(dialogs).toHaveLength(2);
 fireEvent.click(dialogs[1].querySelectorAll("button")[1]);expect(document.body.style.position).toBe("fixed");
 view.unmount();expect(document.body.style.position).toBe("");expect(document.body.hasAttribute("data-scroll-locked")).toBe(false);
});
