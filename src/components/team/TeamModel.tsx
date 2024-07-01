'use client';
import CreateTeam from "./CreateTeam";
import {useState} from "react";
import JoinTeam from "./JoinTeam";

export default function TeamModel() {

    const [isJoinTeam, setIsJoinTeam] = useState(false);

    return !isJoinTeam ?
        <CreateTeam setIsJoinTeam={setIsJoinTeam}/> :
        <JoinTeam setIsJoinTeam={setIsJoinTeam}/>
}