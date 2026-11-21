import {redirect} from "next/navigation";

// VPN is a modal now (header icon, task badge, “My participation”); keep old links working.
export default function VPNPage() {
    redirect("/participation");
}
