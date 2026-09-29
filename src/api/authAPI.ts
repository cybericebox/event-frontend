import {requireApiOrigin} from "@/utils/origins";
export async function signOut(): Promise<void> {
    if (process.env.NEXT_PUBLIC_USE_MOCKS === "1") return;
    const api = requireApiOrigin();
    const response = await fetch(`${api}/api/auth/sign-out`, {
        method: "POST", credentials: "include", cache: "no-store", headers: {Accept: "application/json"},
    });
    if (!response.ok) throw new Error(`Sign-out failed: ${response.status}`);
}
