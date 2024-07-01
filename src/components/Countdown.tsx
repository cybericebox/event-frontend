'use client'

import React, {useEffect, useState} from "react";
import Countdown from "react-countdown";
import cn from "classnames";

let intervalId: NodeJS.Timeout;

export interface CountdownTimerProps {
    text: string;
    children?: React.ReactNode;
    until: Date| number | string;
    from?: Date | number | string;
    className?: string;
}

export function CountdownTimer({text, ...props}: CountdownTimerProps) {
    const [timeNow, setTimeNow] = useState(Date.now())

    const show = (timeNow: number) => {
        return new Date(props.from || 0).getTime() < timeNow && new Date(props.until).getTime() > timeNow
    }

    useEffect(() => {
        if(show(timeNow)) {
            intervalId = setInterval(() => {
                setTimeNow(Date.now())
            }, 1000);
        }
        return () => {
            clearInterval(intervalId);
        };
    }, [props, timeNow]);

    if (!show(timeNow)) {
        if (!!intervalId) {
            clearInterval(intervalId)
        }
        return null
    }

    return (
            <div
                className={cn("flex flex-col space-y-5", props.className)}
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
                {show(timeNow) && props.children}
            </div>
    )
}
