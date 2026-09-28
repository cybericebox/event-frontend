import {RegistrationSection} from "@/components/event/manage/RegistrationSection";

export default async function RegistrationPage({searchParams}: {searchParams: Promise<{tab?: string}>}) {
    const {tab} = await searchParams;
    return <RegistrationSection key={tab ?? "registration"} initialTab={tab} />;
}
