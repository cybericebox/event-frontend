import Image from "next/image";
import type React from "react";
import {WithEventForm} from "@/components/event/WithEvent";
import {CountdownTimer} from "@/components/Countdown";
import {getEventInfoOnServerFn} from "@/api/serverAPI";
import {getPlaiceholder} from "plaiceholder";

async function getBase64Image(src: string) {
    const buffer = await fetch(src).then(async res => Buffer.from(await res.arrayBuffer()));

    const {metadata: {height, width}, ...placeholder} = await getPlaiceholder(buffer, {size: 64});

    return {
        ...placeholder,
        img: {
            src,
            width,
            height,
        }
    }
}

export default async function LandingPage() {
    const eventInfo = await getEventInfoOnServerFn()
    const {img, base64} = await getBase64Image(eventInfo?.Data.Picture || "")

    return (
        <div
            className="md:p-1 flex flex-col gap-5 items-center justify-center"
        >
            {!!eventInfo?.Data &&
                (!!eventInfo?.Data.Picture ?
                        <Image
                            alt={`Banner ${eventInfo?.Data.Name}`}
                            {...img}
                            placeholder={"blur"}
                            blurDataURL={base64}
                            className="rounded-b-lg md:rounded-2xl shadow-2xl lg:max-w-[90vw] xl:max-w-[65vw] w-full"
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
                    className={"px-10 max-w-screen-xl ProseMirror w-full"}
                    dangerouslySetInnerHTML={{__html: eventInfo.Data.Description}}
                />
                )}
        </div>

    );
}
