import type React from "react";
import TeamProfile from "@/components/team/TeamProfile";
import {WithTeamForm} from "@/components/team/WithTeam";
import {WithEventForm} from "@/components/event/WithEvent";

export default function TeamPage() {
    return (
        <WithEventForm>
            <WithTeamForm>
                <TeamProfile/>
            </WithTeamForm>
        </WithEventForm>
    )
}

