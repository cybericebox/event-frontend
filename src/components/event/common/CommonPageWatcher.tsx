"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {isNetworkOutage,reportServiceUnavailable} from "@/utils/serviceStatus";
/** Visitors notice content edits within a minute; an editor previewing with a staff grant sees them within seconds. */
const VISITOR_POLL_MS=60_000;
const STAFF_PREVIEW_POLL_MS=3_000;
export function CommonPageWatcher({revision,page="",staffPreview=false}:{revision:string|null;page?:string;staffPreview?:boolean}) {
    const router=useRouter();
    useEffect(()=>{
        let stopped=false,refreshing=false;
        const controller=new AbortController();
        async function check() {
            if (stopped || refreshing || document.visibilityState==="hidden") return;
            try {
                const response=await fetch(`/api/event-content/revision?page=${encodeURIComponent(page)}`,{cache:"no-store",signal:controller.signal});
                if (stopped) return;
                if (response.status===404) {if (revision!==null) {refreshing=true;router.refresh();} return;}
                if (!response.ok) {
                    if (response.status>=500) reportServiceUnavailable();
                    return;
                }
                const data:unknown=await response.json();
                if (!stopped && typeof data==="object" && data && "Revision" in data && data.Revision!==revision) {refreshing=true;router.refresh();}
            } catch (error) {
                if (!stopped && isNetworkOutage(error,controller.signal)) reportServiceUnavailable();
            }
        }
        const timer=window.setInterval(()=>{void check();},staffPreview ? STAFF_PREVIEW_POLL_MS:VISITOR_POLL_MS);
        const visible=()=>{if(document.visibilityState!=="hidden") void check();};
        document.addEventListener("visibilitychange",visible);
        return ()=>{stopped=true;controller.abort();window.clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
    },[revision,page,router,staffPreview]);
    return null;
}
