import React, {useState} from "react";
import type {IChallengeInfo} from "@/types/challenge";
import {useChallenge} from "@/hooks/useChallenge";
import Loader from "@/components/Loaders";
import ChallengeTile from "@/components/challenge/ChallengeTile";
import ChallengeModal from "@/components/challenge/ChallengeModal";

interface ChallengesViewProps {
    show: boolean;
    allowToSolve: boolean;
}

export default function ChallengesView({show, allowToSolve}: ChallengesViewProps) {
    const [challengeModel, setChallengeModel] = useState<IChallengeInfo>()

    const {GetChallengesResponse, GetChallengesRequest} = useChallenge().useGetChallenges(show)

    return (
        <>
            {GetChallengesRequest.isLoading ? <Loader/> :
                GetChallengesResponse && (
                    GetChallengesResponse.Data.map((category) => (
                            <div
                                key={category.ID}
                                className={"w-full pb-5"}
                            >
                                <div
                                    className={"text-3xl my-5"}
                                >
                                    {category.Name}
                                </div>
                                <div
                                    className={"flex flex-wrap w-full gap-5 items-center"}
                                >
                                    {category.Challenges.map((challenge) => (
                                        <ChallengeTile
                                            key={challenge.ID}
                                            solved={challenge.Solved}
                                            name={challenge.Name}
                                            points={challenge.Points}
                                            onClick={() => setChallengeModel(challenge)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                )}
            {!!challengeModel &&
                <ChallengeModal isOpen={!!challengeModel} onClose={() => setChallengeModel(undefined)} disabled={!allowToSolve}
                                selected={challengeModel}/>}
        </>
    )


}