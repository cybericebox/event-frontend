import axios from "axios";
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

