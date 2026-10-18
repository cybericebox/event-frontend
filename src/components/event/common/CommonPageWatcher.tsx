"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {isNetworkOutage,reportServiceUnavailable} from "@/utils/serviceStatus";
/** A visitor never polls: the revision is checked when the tab becomes visible again, at most once per minute.
 *  An editor previewing with a staff grant polls every few seconds to see live edits. */
const VISIBLE_CHECK_MIN_GAP_MS=60_000;
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
        const timer=staffPreview ? window.setInterval(()=>{void check();},STAFF_PREVIEW_POLL_MS):undefined;
        let lastVisibleCheck=-Infinity;
        const visible=()=>{
            if(document.visibilityState==="hidden") return;
            if(!staffPreview) {
                if(Date.now()-lastVisibleCheck<VISIBLE_CHECK_MIN_GAP_MS) return;
                lastVisibleCheck=Date.now();
            }
            void check();
        };
        document.addEventListener("visibilitychange",visible);
        return ()=>{stopped=true;controller.abort();window.clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
    },[revision,page,router,staffPreview]);
    return null;
}
