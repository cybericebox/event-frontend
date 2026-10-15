"use client";
import {useEffect,useRef} from "react";
import {useRouter} from "next/navigation";
import {apiOrigin} from "@/utils/origins";
const localHeaders={"Content-Type":"application/json","x-cib-event-session":"1"};
/** The primary API session stays on its API host. Only a scoped, short-lived read grant crosses here. */
export function EventReadSession({hasGrant}:{hasGrant:boolean}) {
    const router=useRouter();
    const subject=useRef<string|undefined>(undefined);
    const refreshing=useRef(false);
    useEffect(()=>{
        let stopped=false,running=false;
        const controller=new AbortController();
        async function sync() {
            if (running || stopped || document.visibilityState==="hidden") return;
            running=true;
            try {
                const challenge=await fetch("/api/event-session/challenge",{method:"POST",headers:localHeaders,cache:"no-store",signal:controller.signal});
                if (!challenge.ok) return;
                const {Challenge}=await challenge.json() as {Challenge:string};
                const grant=await fetch(`${apiOrigin}/api/events/self/render-grant`,{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({Challenge}),signal:controller.signal});
                if ([401,403,404].includes(grant.status)) {
                    await fetch("/api/event-session",{method:"DELETE",headers:localHeaders,cache:"no-store",signal:controller.signal});
                    if (!stopped && (hasGrant || subject.current) && !refreshing.current) {subject.current=undefined;refreshing.current=true;router.refresh();}
                    return;
                }
                if (!grant.ok) return;
                const body=await grant.json() as {Data:{Token:string}};
                const installed=await fetch("/api/event-session",{method:"POST",headers:localHeaders,cache:"no-store",body:JSON.stringify({Token:body.Data.Token}),signal:controller.signal});
                if (!installed.ok) return;
                const data=await installed.json() as {Subject:string};
                if (!stopped && subject.current!==data.Subject) {subject.current=data.Subject;refreshing.current=false;router.refresh();}
            } catch { /* Bounded grant expires on its own; failed renewal cannot prolong access. */ }
            finally {running=false;}
        }
        void sync();
        const timer=window.setInterval(()=>{void sync();},40_000);
        const visible=()=>{if(document.visibilityState!=="hidden") void sync();};
        window.addEventListener("focus",visible);document.addEventListener("visibilitychange",visible);
        return ()=>{stopped=true;controller.abort();window.clearInterval(timer);window.removeEventListener("focus",visible);document.removeEventListener("visibilitychange",visible);};
    },[hasGrant,router]);
    return null;
}
