'use client'

import {Button} from "@/components/ui/button";
import Link from "next/link";

export default function Error({
                                  error,
                                  reset,
                              }: {
    error: Error
    reset: () => void
}) {


    return (
        <div
            className={"flex flex-col items-center justify-center h-full w-full gap-10"}
        >
            <h1 className={"text-2xl text-orange-600 font-bold"}>Щось пішло не так</h1>
            <pre className={"text-xl text-wrap text-center"}>{error.message}</pre>
            <Button
                onClick={
                    // Attempt to recover by trying to re-render the segment
                    () => reset()
                }
            >
                Спробувати ще раз
            </Button>
            <Link
                href={"/"}
            >
                Повернутися на головну
            </Link>
        </div>
    )
}