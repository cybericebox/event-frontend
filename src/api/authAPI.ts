import {requireApiOrigin} from "@/utils/origins";
import {clearCachedBrand} from "@/utils/eventBrandCache";
export async function signOut(): Promise<void> {
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/auth/sign-out`, {
        method: "POST", credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new Error(`Sign-out failed: ${response.status}`);
    // The signed-out browser keeps neither the remembered private branding nor the staff read grant.
    clearCachedBrand();
    await fetch("/api/event-session", {method: "DELETE", cache: "no-store", headers: {"Content-Type": "application/json", "x-cib-event-session": "1"}}).catch(() => undefined);
}
