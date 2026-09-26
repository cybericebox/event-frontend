import type React from "react";
import TeamProfile from "@/components/team/TeamProfile";
import {WithTeamForm} from "@/components/team/WithTeam";
import {WithEventForm} from "@/components/event/WithEvent";
import {LegacyTeamProvider} from "@/components/team/LegacyTeamProvider";

export default function TeamPage() {
    return (
        <LegacyTeamProvider>
            <WithEventForm>
                <WithTeamForm>
                    <TeamProfile/>
                </WithTeamForm>
            </WithEventForm>
        </LegacyTeamProvider>
    )
}
