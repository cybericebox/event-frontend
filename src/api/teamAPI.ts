import {baseAPI} from "@/api/baseAPI";
import {AxiosResponse} from "axios";
import {IResponse} from "@/types/api";
import {ICreateTeam, IJoinTeam, ITeam, IVPNConfig} from "@/types/user";

export const getTeamFn = async ():Promise<AxiosResponse<IResponse<ITeam>, any>> => {
    return await baseAPI.get('/events/self/teams/self')
}

export const getVPNConfig = async ():Promise<AxiosResponse<IResponse<IVPNConfig>, any>> => {
    return await baseAPI.get('/events/self/teams/self/vpn-config')
}

export const createTeamFn = async (data: ICreateTeam):Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.post('/events/self/teams', data)
};

export const joinTeamFn = async (data: IJoinTeam):Promise<AxiosResponse<IResponse, any>>  => {
    return await baseAPI.post('/events/self/teams/join', data)
};