import { useQuery } from "@tanstack/react-query"
import { z } from "zod"
import { getNotificationsFn } from "@/api/eventAPI"
import { NotificationSchema } from "@/types/notification"
import { ErrorInvalidResponseData } from "@/types/common"

// Thin read hook for the notifications popover. Mirrors the useEvent pattern:
// react-query useQuery with a zod safeParse in `select`. With NEXT_PUBLIC_USE_MOCKS=1
// the request resolves from the Task-4 fixtures via the axios mock adapter.
export const useGetNotifications = () => {
    const {
        data: GetNotificationsResponse,
        isLoading,
        isError,
        isSuccess,
        error,
        refetch: GetNotifications,
    } = useQuery({
        queryKey: ["selfNotifications"],
        queryFn: getNotificationsFn,
        select: (data) => {
            const res = z.array(NotificationSchema).safeParse(data.data.Data)
            if (!res.success) {
                console.log(res.error)
                throw ErrorInvalidResponseData
            } else {
                data.data.Data = res.data
            }

            return data.data
        },
    })

    const GetNotificationsRequest = { isLoading, isError, isSuccess, error }

    return { GetNotificationsResponse, GetNotificationsRequest, GetNotifications }
}
