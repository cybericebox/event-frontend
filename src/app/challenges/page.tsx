'use client'

import React, {useEffect, useState} from "react";
import {MdOutlinedFlag} from "react-icons/md";
import {useEvent} from "@/hooks/useEvent";
import "@/app/globals.css" //TODO: remove global styles with challenges-page classname
import {WithEventForm} from "@/components/event/WithEvent";
import {CountdownTimer} from "@/components/Countdown";
import {WithTeamForm} from "@/components/team/WithTeam";
import ChallengesModel from "@/components/challenge/ChellengesModel";


export default function ChallengesPage() {
    const [timeNow, setTimeNow] = useState(Date.now())

    const eventInfo = useEvent().useGetEventInfo()

    const showInMillisecondsToFinish = 60 * 1000 * 10; //  10 minutes

    const showChallenges =
        new Date(eventInfo.data?.StartTime || 0).getTime() < timeNow
    const canSolveChallenges = new Date(eventInfo.data?.StartTime || 0).getTime() < timeNow
        && new Date(eventInfo.data?.FinishTime || 0).getTime() > timeNow;

    const showTimeIsOver = new Date(eventInfo.data?.FinishTime || 0).getTime() < timeNow;


    useEffect(() => {
        const interval = setInterval(() => {
            setTimeNow(Date.now)

        }, 1000);
        return () => {
            clearInterval(interval);
        };
    }, []);

    return (
        <div
            className={"flex flex-col max-w-screen-2xl w-full mx-auto text-[#211a52] challenges-page"}
        >
            <div
                className={"w-full my-12"}
            >
                <div
                    className={"flex items-center justify-center w-full text-5xl"}
                >
                    <MdOutlinedFlag/>
                    <div
                        className={"ml-5"}
                    >
                        Завдання
                    </div>
                </div>
            </div>
            <div
                className={"px-10"}
            >
            <WithEventForm>
                <WithTeamForm>
                    <CountdownTimer
                        text={"Завдання стануть доступні через"}
                        until={eventInfo?.data?.StartTime || 0}
                        className={"text-lg md:text-2xl font-bold text-[#211a52] rounded-lg border border-gray-200 shadow-lg p-3 md:px-4 md:py-5"}
                    />
                    <CountdownTimer
                        text={"Відповіді не будуть прийматися через"}
                        until={eventInfo?.data?.FinishTime || 0}
                        // show time to finish for 10 minutes to the end. if from start to finish less than 10 minutes, from start to finish
                        from={
                            Math.max(
                                new Date(eventInfo.data?.FinishTime || 0).getTime() - showInMillisecondsToFinish,
                                new Date(eventInfo.data?.StartTime || 0).getTime()
                            )}
                        className={"text-lg md:text-2xl font-bold text-[#211a52] rounded-lg border border-gray-200 shadow-lg p-3 md:px-4 md:py-5"}
                    />
                    {showTimeIsOver &&
                        <div
                            className={"text-lg md:text-2xl font-bold text-[#211a52] rounded-lg border border-gray-200 shadow-lg p-3 md:px-4 md:py-5"}
                        >
                            {"Відповіді більше не приймаються. Дякуємо за участь!"}
                        </div>
                    }
                    <ChallengesModel show={showChallenges} allowToSolve={canSolveChallenges} />
                </WithTeamForm>
            </WithEventForm>
            </div>
        </div>
    );
}
