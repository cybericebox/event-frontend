'use client'
import {useEvent} from "@/hooks/useEvent"
import {useEffect, useState} from "react"
import {SlGraph} from "react-icons/sl";
import {WithEventForm} from "@/components/event/WithEvent";
import ScoreBoard from "@/components/scoreboard/ScoreBoard";
import Loader from "@/components/Loaders";
import {ScoreboardVisibilityType} from "@/types/event";

let intervalId: NodeJS.Timeout;

export default function ScoreboardPage() {
    const eventInfo = useEvent().useGetEventInfo()
    const [timeNow, setTimeNow] = useState(Date.now())
    const showScoreboard = new Date(eventInfo.data?.StartTime || 0).getTime() < timeNow

    useEffect(() => {
        if(!!intervalId && !showScoreboard) {
            intervalId = setInterval(() => {
                setTimeNow(Date.now)

            }, 1000);
        }
        return () => {
            clearInterval(intervalId);
        };
    }, []);

    if (!!intervalId && showScoreboard) {
        clearInterval(intervalId)
    }

    return (
        <div
            className={"flex flex-col max-w-screen-2xl w-full mx-auto text-[#211a52]"}
        >
            <div
                className={"w-full my-12"}
            >
                <div
                    className={"flex items-center justify-center w-full text-5xl"}
                   >
                    <SlGraph/>
                    <div
                        className={"ml-5"}
                    >
                        Результати
                    </div>
                </div>
            </div>
            <div
                className={"px-10"}
            >
                {
                    eventInfo.data && (
                            <WithEventForm skip={eventInfo.data?.ScoreboardAvailability === ScoreboardVisibilityType.Public}>
                                <ScoreBoard show={showScoreboard}/>
                            </WithEventForm>

                    )
                }
            </div>
        </div>
    );
}