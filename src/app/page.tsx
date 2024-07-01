import Image from "next/image";
import type React from "react";
import {WithEventForm} from "@/components/event/WithEvent";
import {CountdownTimer} from "@/components/Countdown";
import {getEventInfoOnServerFn} from "@/api/serverAPI";


export default async function LandingPage() {
    const eventInfo = await getEventInfoOnServerFn()

    return (
        <div
            className="flex flex-col m-auto text-[#211a52] h-full w-full items-center justify-center space-y-4 md:space-y-6"
        >
            {!!eventInfo &&
                (!!eventInfo?.Picture ?
                        <Image
                            src={eventInfo?.Picture}
                            alt={`Banner ${eventInfo?.Name}`}
                            width={1920}
                            height={1080}
                            priority
                            className={"max-h-[70lvh] w-auto md:mt-2 rounded-b-lg md:rounded-lg shadow-2xl"}
                            placeholder={"blur"}
                        />
                        : <center>
                            <div
                                className={"text-5xl font-bold mt-5 md:mt-10 max-w-screen-2xl"}
                            >
                                {eventInfo?.Name}
                            </div>
                        </center>
                )
            }

            <WithEventForm>
                <CountdownTimer
                    text={"До початку заходу залишилось"}
                    until={eventInfo?.StartTime || 0}
                    className={"text-lg md:text-2xl font-bold text-[#211a52] rounded-lg border border-gray-200 shadow-lg p-3 md:px-4 md:py-5"}
                />
            </WithEventForm>
            {!!eventInfo && (
                <div
                    className={"text-lg md:text-xl font-medium mx-auto px-10 max-w-screen-xl"}
                >
                        <div
                            dangerouslySetInnerHTML={{
                                __html: eventInfo?.Description,
                            }}
                        />
                    </div>
                )}
        </div>

    );
}
