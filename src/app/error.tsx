'use client'

import {useEffect} from "react";
import {Button} from "@/components/ui/button";
import Link from "next/link";
import {t} from "@/i18n/t";

export default function Error({
                                  error,
                                  reset,
                              }: {
    error: Error
    reset: () => void
}) {
    // Raw error text is for developers only; users get a friendly message.
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <div
            className={"flex flex-col items-center justify-center h-full w-full gap-10"}
        >
            <h1 className={"text-2xl text-orange-600 font-bold"}>{t("error.generic")}</h1>
            <p className={"text-xl text-wrap text-center"}>{t("error.page.body")}</p>
            <Button
                onClick={
                    // Attempt to recover by trying to re-render the segment
                    () => reset()
                }
            >
                {t("common.retryAgain")}
            </Button>
            <Link
                href={"/"}
            >
                {t("common.backHome")}
            </Link>
        </div>
    )
}