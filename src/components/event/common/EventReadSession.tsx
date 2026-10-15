"use client";
import {useEffect,useRef} from "react";
import {usePathname,useRouter} from "next/navigation";
import {apiOrigin} from "@/utils/origins";
import {commonPageSlug} from "@/utils/commonPagePath";
import {resetEventGone} from "@/utils/eventGone";
import {CommonPageWatcher} from "./CommonPageWatcher";
const localHeaders={"Content-Type":"application/json","x-cib-event-session":"1"};
type Props={hasGrant:boolean;expiresAt?:number;serverPath:string;revision:string|null;publicEvent:boolean};
/** Root layouts survive navigation. Activate common reads from the live client path. */
export function EventReadSession({hasGrant,expiresAt,serverPath,revision,publicEvent}:Props) {
    const pathname=usePathname();
    const router=useRouter();
    const previousPath=useRef(serverPath);
    const page=commonPageSlug(pathname);
    useEffect(()=>{
        const entered=previousPath.current!==pathname;
        previousPath.current=pathname;
        if (page!==null && entered) router.refresh();
    },[pathname,page,router]);
    useEffect(()=>{
        // Only a fresh server manifest clears denial; installing a cookie alone is not permission.
        if (page!==null && serverPath===pathname && revision!==null) resetEventGone();
    },[pathname,page,serverPath,revision,hasGrant,expiresAt]);
    if (page===null) return null;
    return <>
        <CommonPageWatcher page={page} revision={serverPath===pathname ? revision:null} />
        {serverPath===pathname && !publicEvent && <GrantSynchronizer hasGrant={hasGrant} expiresAt={expiresAt} />}
    </>;
}

/** The primary API session stays on its API host. Reuse verified read cookies until renewal is due. */
function GrantSynchronizer({hasGrant,expiresAt}:{hasGrant:boolean;expiresAt?:number}) {
    const router=useRouter();
    const signedOut=useRef(false);
    useEffect(()=>{
        let stopped=false,running=false,installedGrant=hasGrant;
        let expiry=expiresAt ?? 0;
        let failures=0;
        let timer:number|undefined;
        const controller=new AbortController();
        function schedule(delay:number|null) {
            window.clearTimeout(timer);
            if (!stopped && delay!==null) timer=window.setTimeout(()=>{void sync();},delay);
        }
        async function sync() {
            if (running || stopped || document.visibilityState==="hidden") return;
            const remaining=expiry*1000-Date.now()-15_000;
            if (installedGrant && remaining>0) {schedule(remaining);return;}
            running=true;
            window.clearTimeout(timer);
            let retryAfter:number|null=5000*2**failures;
            failures=Math.min(failures+1,3);
            try {
                const challenge=await fetch("/api/event-session/challenge",{method:"POST",headers:localHeaders,cache:"no-store",signal:controller.signal});
                if (!challenge.ok) return;
                const {Challenge}=await challenge.json() as {Challenge:string};
                const grant=await fetch(`${apiOrigin}/api/events/self/render-grant`,{method:"POST",credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({Challenge}),signal:controller.signal});
                if ([401,403,404].includes(grant.status)) {
                    // Signed-out readers retry only on an explicit browser signal. Denied staff access is checked sparingly.
                    signedOut.current=grant.status===401;
                    retryAfter=signedOut.current ? null:40_000;
                    failures=0;
                    await fetch("/api/event-session",{method:"DELETE",headers:localHeaders,cache:"no-store",signal:controller.signal});
                    if (!stopped && installedGrant) {installedGrant=false;expiry=0;router.refresh();}
                    return;
                }
                if (!grant.ok) return;
                const body=await grant.json() as {Data:{Token:string}};
                const installed=await fetch("/api/event-session",{method:"POST",headers:localHeaders,cache:"no-store",body:JSON.stringify({Token:body.Data.Token}),signal:controller.signal});
                if (!installed.ok) return;
                const data=await installed.json() as {ExpiresAt:number};
                if (!stopped) {
                    installedGrant=true;expiry=data.ExpiresAt;failures=0;
                    retryAfter=Math.max(5000,expiry*1000-Date.now()-15_000);
                    router.refresh();
                }
            } catch { /* Failed renewal cannot extend the signed cookie's lifetime. */ }
            finally {
                running=false;
                schedule(retryAfter);
            }
        }
        if (!signedOut.current) void sync();
        const visible=()=>{
            if(document.visibilityState!=="hidden") {signedOut.current=false;void sync();}
        };
        window.addEventListener("focus",visible);document.addEventListener("visibilitychange",visible);
        return ()=>{stopped=true;controller.abort();window.clearTimeout(timer);window.removeEventListener("focus",visible);document.removeEventListener("visibilitychange",visible);};
    },[hasGrant,expiresAt,router]);
    return null;
}
