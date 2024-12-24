"use client";
import {getCookie} from "cookies-next/client"
import {type IAuthenticated} from "@/types/auth";

const permissionsTokenField = "permissionsToken"

export function ClientAuthentication(): IAuthenticated {
    try {
        const token = getCookie(permissionsTokenField)
        // if no token, return false
        if (!token) {
            return {
                IsAuthenticated: false,
                ID: ""
            }
        }

        // if token is string, parse it
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

