'use server'
import {cookies} from "next/headers";
import {Authenticated} from "@/types/user";

const permissionsTokenField = "permissionsToken"

export async function AuthenticatedOnServer(): Promise<Authenticated> {
    const token = cookies().get(permissionsTokenField)?.value || ""
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





