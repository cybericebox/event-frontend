import {baseAPI} from "@/api/baseAPI";
import {AxiosResponse} from "axios";
import {IResponse} from "@/types/api";

export const signOut = async (): Promise<AxiosResponse<IResponse, any>> => {
    return await baseAPI.post('/auth/sign-out')
}