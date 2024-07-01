import React, {useState} from "react";
import type {Challenge} from "@/types/challenge";
import {useChallenge} from "@/hooks/useChallenge";
import Loader from "@/components/Loaders";
import ChallengeTile from "@/components/challenge/ChallengeTile";
import ChallengeModal from "@/components/challenge/ChallengeModal";

interface ChallengesModelProps {
    show: boolean;
    allowToSolve: boolean;
}

export default function ChallengesModel({show, allowToSolve}: ChallengesModelProps) {
    const [selected, setSelected] = useState<Challenge | null>()
    const [isModalOpen, setIsModalOpen] = useState(false);
    const onModalClose = () => setIsModalOpen(false);

    const challenges = useChallenge().useGetChallenges(show)

    const openModal = (challenge: Challenge) => {
        setSelected(challenge)
        setIsModalOpen(true);
    };

    return (
        <>
            {challenges.isLoading ? <Loader/> :
                challenges?.data && (
                    challenges?.data.map((category) => (
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
                                            onClick={() => openModal(challenge)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                )}
            {!!selected &&
                <ChallengeModal isOpen={isModalOpen} onClose={onModalClose} disabled={!allowToSolve}
                                selected={selected}/>}
        </>
    )


}