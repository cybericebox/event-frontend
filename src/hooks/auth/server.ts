"use server";
import {cookies} from "next/headers";
import {IAuthenticated} from "@/types/auth";

const permissionsTokenField = "permissionsToken"

export async function AuthenticatedServer(): Promise<IAuthenticated> {
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





