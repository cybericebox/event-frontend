"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
export function CommonPageWatcher({revision,page=""}:{revision:string;page?:string}) {
    const router=useRouter();
    useEffect(()=>{
        let stopped=false,refreshing=false;
        const controller=new AbortController();
        async function check() {
            if (stopped || refreshing || document.visibilityState==="hidden") return;
            try {
                const response=await fetch(`/api/event-content/revision?page=${encodeURIComponent(page)}`,{cache:"no-store",signal:controller.signal});
                if (stopped) return;
                if (response.status===404) {refreshing=true;router.refresh();return;}
                if (!response.ok) return;
                const data:unknown=await response.json();
                if (!stopped && typeof data==="object" && data && "Revision" in data && data.Revision!==revision) {refreshing=true;router.refresh();}
            } catch { /* The outage gate handles API outages; the next visible tick retries. */ }
        }
        const timer=window.setInterval(()=>{void check();},2000);
        const visible=()=>{if(document.visibilityState!=="hidden") void check();};
        document.addEventListener("visibilitychange",visible);
        return ()=>{stopped=true;controller.abort();window.clearInterval(timer);document.removeEventListener("visibilitychange",visible);};
    },[revision,page,router]);
    return null;
}
