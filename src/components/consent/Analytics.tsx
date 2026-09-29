import Script from "next/script";
import {gtagBootScript} from "@/utils/consent";
import {mainOrigin} from "@/utils/origins";
import {ConsentBanner} from "./ConsentBanner";

// Google Analytics (gtag) under Consent Mode v2. The inline boot sets the denied defaults and the
// stored choice before gtag.js runs (see utils/consent). The cookie policy lives on the main site.
export function Analytics({gaId}: {gaId: string}) {
    return <>
        <Script id="ga-init" strategy="afterInteractive">{gtagBootScript(gaId)}</Script>
        <Script id="ga" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaId)}`} />
        <ConsentBanner gaId={gaId} policyHref={`${mainOrigin}/cookies`} />
    </>;
}
