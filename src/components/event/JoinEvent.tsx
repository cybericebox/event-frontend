'use client'
import type React from "react";
import {useEvent} from "@/hooks/useEvent";
import {CountdownTimer} from "@/components/Countdown";
import Link from "next/link";
import {AuthenticatedClient} from "@/hooks/auth";

export default function JoinEvent() {
    const {GetEventInfoResponse} = useEvent().useGetEventInfo()
    const {JoinEvent} = useEvent().useJoinEvent()
    return (
        <div
            className={"flex flex-col w-full items-center justify-center"}
        >
            <div
                className={"text-lg md:text-xl font-bold text-[#211a52]"}
            >
                <CountdownTimer
                    text={"До початку заходу залишилось"}
                    until={GetEventInfoResponse?.Data.StartTime || 0}
                    className={"rounded-lg border border-gray-200 shadow-md px-4 py-5"}
                >
                    {
                        AuthenticatedClient().IsAuthenticated ?
                            <button
                                onClick={() =>JoinEvent()}
                                className={"bg-[#211a52] w-full hover:opacity-70 text-white font-bold py-2 px-4 rounded text-md md:text-lg text-center"}
                            >
                                Доєднатися до заходу
                            </button> : <Link href={"/api/events/self/join"}
                                              prefetch={false}
                                              className={"bg-[#211a52] w-full hover:opacity-70 text-white font-bold py-2 px-4 rounded text-md md:text-lg text-center"}
                            >
                                Доєднатися до заходу
                            </Link>
                    }

                </CountdownTimer>
            </div>
        </div>
    );
}

