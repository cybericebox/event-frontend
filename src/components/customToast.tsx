import {IErrorResponse} from "@/types/api";
import toast, {ToastOptions} from "react-hot-toast";

interface IToastOptions extends ToastOptions {
    cause?: Error;
}

export const ErrorToast = (message: string, options?: IToastOptions) => {
    const errorMessage = ErrorMessage(message, options?.cause)

    toast.error(errorMessage, options)

}

export const SuccessToast = (message: string, options?: ToastOptions) => {
    toast.success(message, options)
}


export const ErrorMessage = (message: string, cause?: Error | IErrorResponse | null) => {
    if (!cause) {
        return message
    }
    const error = cause as IErrorResponse
    const errorCauseDescription = error?.response?.data?.Status?.Message || ""
    const errorCauseCode = error?.response?.data?.Status?.Code || ""

    if (errorCauseCode != "") {
        return `${message}\n"${errorCauseDescription}" (${errorCauseCode})`
    }

    return `${message}\n"${cause?.message}"`
}

export const ErrorHTMLMessage = (message: string, cause?: Error | IErrorResponse | null) => {
    if (!cause) {
        return <div className={"font-bold text-center text-2xl  w-full"}>{message}</div>
    }
    const error = cause as IErrorResponse
    const errorCauseDescription = error?.response?.data?.Status?.Message || ""
    const errorCauseCode = error?.response?.data?.Status?.Code || ""

    if (errorCauseCode != "") {
        return <div
            className={"text-center flex flex-col gap-2  w-full"}
        >
            <div className={"font-bold text-lg  w-full"}>{message}</div>
            <div className={"text-center  w-full"}>&quot;{errorCauseDescription}&quot; ({errorCauseCode})</div>
        </div>
    }

    return <div
        className={"text-center flex flex-col gap-2 w-full text-wrap"}
    >
        <div className={"font-bold text-lg  w-full"}>{message}</div>
        <div className={"text-center  w-full"}>&quot;{cause?.message}&quot;</div>
    </div>
}