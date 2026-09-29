import {MailSection} from "@/components/event/manage/MailSection";

export default async function MailPage({searchParams}: {searchParams: Promise<{tab?: string}>}) {
    const {tab} = await searchParams;
    return <MailSection key={tab ?? "settings"} initialTab={tab} />;
}
