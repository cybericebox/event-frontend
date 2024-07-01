import {getCookie} from "cookies-next"
import {Authenticated} from "@/types/user";

const permissionsTokenField = "permissionsToken"

export function AuthenticatedOnClient(): Authenticated {
    const token = getCookie(permissionsTokenField) || ""
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        const userID = payload?.sub
        return {
            IsAuthenticated: !!userID,
            ID: userID
        }
    } catch (e) {
        return {
            IsAuthenticated: false,
            ID: ""
        }
    }
}

export const SignOut = async () => {
    return await fetch('/api/auth/sign-out', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
    });
}





