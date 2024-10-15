import axios, {AxiosResponse} from "axios";

export const baseAPI = axios.create({
    baseURL: "/api",
    withCredentials: true,
    headers: {
        Accept: "application/json",
    },
});


// Add a response interceptor to handle errors and refresh page
baseAPI.interceptors.response.use((response: AxiosResponse) => response,
    (error) => {
        if (error.response?.status === 401) {
            if (typeof window !== "undefined") {
                window.location.reload();
            }
        }
        return Promise.reject(error);
    });

