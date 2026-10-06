import {redirect} from "next/navigation";

// VPN is a modal now (header icon, task badge, «Моя участь»); keep old links working.
export default function VPNPage() {
    redirect("/participation");
}
