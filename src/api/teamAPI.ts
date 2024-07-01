import {Team} from "@/types/user";
import {redirect, } from "next/navigation";

export const getTeamFn = async (): Promise<Team> => {
    return await fetch('api/events/self/teams/self', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to get team", {
                cause: res
            })
        }
    })

}

export const getVPNConfig = async (): Promise<string> => {
    return await fetch('/api/events/self/teams/self/vpn-config', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        },
        credentials: 'include'
    }).then(res => {
        if (res.ok) {
            return res.json();
        } else {
            throw new Error("Failed to get vpn-config", {
                cause: res
            })
        }
    })
}

export interface CreateTeamData {
    Name: string;
}

export const createTeamFn = async (name: CreateTeamData) => {
    return await fetch('api/events/self/teams', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(name),
        credentials: 'include'
    }).then(res => res.json());
};

export interface JoinTeamData {
    Name: string;
    JoinCode: string;
}

export const joinTeamFn = async (data: JoinTeamData) => {
    return await fetch('api/events/self/teams/join', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        credentials: 'include'
    }).then(res => res.json());
};