import Image from "next/image";
import type React from "react";
import {WithEventForm} from "@/components/event/WithEvent";
import {CountdownTimer} from "@/components/Countdown";
import {getEventInfoOnServerFn} from "@/api/serverAPI";


export default async function LandingPage() {
    const eventInfo = await getEventInfoOnServerFn()

    return (
        <div
            className="flex flex-col text-[#211a52] h-full w-full space-y-4 md:space-y-6 items-center justify-center md:p-1"
        >
            {!!eventInfo?.Data &&
                (!!eventInfo?.Data.Picture ?
                        <Image
                            src={eventInfo?.Data.Picture}
                            alt={`Banner ${eventInfo?.Data.Name}`}
                            width={1920}
                            height={1080}
                            priority
                            className={"max-h-screen md:max-h-[70dvh] w-auto max-w-full  rounded-b-lg md:rounded-2xl shadow-2xl"}
                        />
                        : <center>
                            <div
                                className={"text-5xl font-bold mt-5 md:mt-10 max-w-screen-2xl"}
                            >
                                {eventInfo?.Data.Name}
                            </div>
                        </center>
                )
            }

            <WithEventForm>
                <CountdownTimer
                    text={"До початку заходу залишилось"}
                    until={eventInfo?.Data?.StartTime || 0}
                    className={"text-lg md:text-2xl font-bold text-[#211a52] rounded-lg border border-gray-200 shadow-lg p-3 md:px-4 md:py-5"}
                />
            </WithEventForm>
            {!!eventInfo?.Data && (
                <div
                    className={"px-10 max-w-screen-2xl ProseMirror w-full"}
                    dangerouslySetInnerHTML={{__html: eventInfo.Data.Description}}
                />
                )}
        </div>

    );
}
