import {baseAPI} from "@/api/baseAPI";
import {AxiosResponse} from "axios";
import {IResponse} from "@/types/api";
import {IEventInfo, IJoinEventInfo, IEventScore} from "@/types/event";

export const getEventInfoFn = async (): Promise<AxiosResponse<IResponse<IEventInfo>, any>> => {
    return await baseAPI.get('/events/self/info')
}

export const getJoinEventStatusFn = async (): Promise<AxiosResponse<IResponse<IJoinEventInfo>, any>> => {
    return await baseAPI.get('/events/self/join/info')
}

export const joinEventFn = async (): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.get('/events/self/join?noRedirect=true')
}

export const getScore = async (): Promise<AxiosResponse<IResponse<IEventScore>, any>> => {
    return await baseAPI.get('/events/self/score')
}