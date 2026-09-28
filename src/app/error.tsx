'use client'

import {useEffect} from "react";
import {Button} from "@/components/ui/button";
import Link from "next/link";

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
            <h1 className={"text-2xl text-orange-600 font-bold"}>Щось пішло не так</h1>
            <p className={"text-xl text-wrap text-center"}>Не вдалося відкрити сторінку. Спробуйте ще раз або поверніться на головну.</p>
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