"use client";

import {useEffect,useState} from "react";
import {Check,Copy} from "lucide-react";
import {EventTooltip} from "@/components/ui/EventTooltip";
import {t} from "@/i18n/t";

export function VpnCommand({value,inline=false}:{value:string;inline?:boolean}) {
    const [feedback,setFeedback]=useState<"idle"|"copied"|"error">("idle");
    useEffect(()=>{
        if(feedback==="idle") return;
        const timer=window.setTimeout(()=>setFeedback("idle"),2000);
        return ()=>window.clearTimeout(timer);
    },[feedback]);
    const label=t(feedback==="copied"?"vpn.copy.done":"vpn.copy.action",{command:value});
    const copy=async()=>{
        try {await navigator.clipboard.writeText(value);setFeedback("copied");}
        catch {setFeedback("error");}
    };
    const button=<button type="button" className={`vpn-command__button${inline?" vpn-command__button--inline":""}${feedback==="copied"?" is-copied":""}`} aria-label={label} onClick={()=>void copy()}>
        {inline?<code>{value}</code>:feedback==="copied"?<Check aria-hidden="true"/>:<Copy aria-hidden="true"/>}
    </button>;
    const control=<EventTooltip content={label} floating silent>{() => button}</EventTooltip>;
    const message=feedback==="copied"?<span role="status" className="vpn-command__feedback">{t("vpn.copy.done")}</span>:feedback==="error"?<span role="alert" className="vpn-command__error">{t("vpn.copy.failed")}</span>:null;
    return inline?<span className="vpn-command">{control}{message}</span>:<div className="vpn-command"><div className="vpn-command__block"><pre><code>{value}</code></pre>{control}</div>{message}</div>;
}
