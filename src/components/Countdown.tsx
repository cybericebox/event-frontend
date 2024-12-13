'use client'

import React, {useEffect, useState} from "react";
import Countdown from "react-countdown";
import {cn} from "@/utils/cn";

let intervalId: NodeJS.Timeout;

export interface CountdownTimerProps {
    text: string;
    textAfter?: string;
    show?: boolean;
    children?: React.ReactNode;
    until: Date| number | string;
    from?: Date | number | string;
    className?: string;
}

export function CountdownTimer({text, textAfter, ...props}: CountdownTimerProps) {
    const [timeNow, setTimeNow] = useState(Date.now())

    const showTimer = (timeNow: number) => {
        return new Date(props.from || 0).getTime() < timeNow && new Date(props.until).getTime() > timeNow
    }

    useEffect(() => {
        if(showTimer(timeNow)) {
            intervalId = setInterval(() => {
                setTimeNow(Date.now())
            }, 1000);
        }
        return () => {
            clearInterval(intervalId);
        };
    }, [props, timeNow]);

    // if time over, but show is true
    if (!showTimer(timeNow) && !!props.show) {
        return (
            <div
                className={cn("flex flex-col md:min-w-[400px] min-w-80", textAfter?.length ? "space-y-5" : "" ,props.className)}
            >
                <center>
                    <div
                        className={"h-full w-full flex flex-col md:flex-row items-center justify-center"}
                    >
                        {textAfter}

                    </div>
                </center>
                {props.children}
            </div>
        )
    }

    if (!showTimer(timeNow)) {
        if (!!intervalId) {
            clearInterval(intervalId)
        }
        return null
    }

    return (
        <div
            className={cn("flex flex-col space-y-5 md:min-w-[400px] min-w-80", props.className)}
        >
            <center>
                <div
                    className={"h-full w-full flex flex-col md:flex-row items-center justify-center"}
                >
                    {text}:
                    <div
                        className={"ml-2.5"}
                    >
                        <Countdown date={props.until}/>
                        </div>

                    </div>
                </center>
                {props.children}
            </div>
    )
}
