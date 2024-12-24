'use client'

import React, {useEffect, useState} from "react";
import {MdOutlinedFlag} from "react-icons/md";
import {useEvent} from "@/hooks/useEvent";
import {WithEventForm} from "@/components/event/WithEvent";
import {CountdownTimer} from "@/components/Countdown";
import {WithTeamForm} from "@/components/team/WithTeam";
import ChallengesView from "@/components/challenge/ChallengesView";


export default function ChallengesPage() {
    const [timeNow, setTimeNow] = useState(Date.now())

    const {GetEventInfoResponse} = useEvent().useGetEventInfo()

    const showInMillisecondsToFinish = 60 * 1000 * 10; //  10 minutes

    const showChallenges =
        new Date(GetEventInfoResponse?.Data.StartTime || 0).getTime() < timeNow
    const canSolveChallenges = new Date(GetEventInfoResponse?.Data.StartTime || 0).getTime() < timeNow
        && new Date(GetEventInfoResponse?.Data.FinishTime || 0).getTime() > timeNow;

    const showTimeIsOver = new Date(GetEventInfoResponse?.Data.FinishTime || 0).getTime() < timeNow;


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
                        until={GetEventInfoResponse?.Data.StartTime || 0}
                        className={"text-lg md:text-2xl font-bold text-[#211a52] rounded-lg border border-gray-200 shadow-lg p-3 md:px-4 md:py-5"}
                    />
                    <CountdownTimer
                        text={"Відповіді не будуть прийматися через"}
                        until={GetEventInfoResponse?.Data.FinishTime || 0}
                        // show time to finish for 10 minutes to the end. if from start to finish less than 10 minutes, from start to finish
                        from={
                            Math.max(
                                new Date(GetEventInfoResponse?.Data.FinishTime || 0).getTime() - showInMillisecondsToFinish,
                                new Date(GetEventInfoResponse?.Data.StartTime || 0).getTime()
                            )}
                        className={"text-lg md:text-2xl font-bold text-[#211a52] rounded-lg border border-gray-200 shadow-lg p-3 md:px-4 md:py-5"}
                    />
                    {showTimeIsOver &&
                        <div
                            className={"text-lg md:text-2xl font-bold text-[#211a52] rounded-lg border border-gray-200 shadow-lg p-3 md:px-4 md:py-5 text-center"}
                        >
                            {"Відповіді більше не приймаються. Дякуємо за участь!"}
                        </div>
                    }
                    <ChallengesView show={showChallenges} allowToSolve={canSolveChallenges} />
                </WithTeamForm>
            </WithEventForm>
            </div>
        </div>
    );
}
