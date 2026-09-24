import axios, {AxiosResponse} from "axios";
import {installMockAdapter} from "@/api/mock/adapter";

export const baseAPI = axios.create({
    baseURL: `https://api.${process.env.NEXT_PUBLIC_DOMAIN}/api`,
    withCredentials: true,
    headers: {
        Accept: "application/json",
    },
});

// No-op unless NEXT_PUBLIC_USE_MOCKS === "1"; serves fixtures for known routes when enabled.
installMockAdapter(baseAPI);


// Add a response interceptor to handle errors and refresh page
baseAPI.interceptors.response.use((response: AxiosResponse) => response,
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            if (typeof window !== "undefined") {
                window.onbeforeunload = null
                window.location.reload();
            }
        }
        return Promise.reject(error);
    });
