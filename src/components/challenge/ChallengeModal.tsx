"use client"

import {
    Flex,
    Modal,
    ModalBody,
    ModalCloseButton,
    ModalContent,
    ModalOverlay,
    Tab,
    TabList,
    TabPanel,
    TabPanels,
    Tabs,
} from "@chakra-ui/react";
import React from "react";
import ChallengeForm from "@/components/challenge/ChallengeForm";
import {useChallenge} from "@/hooks/useChallenge";
import ChallengeSolvesTable from "@/components/challenge/ChallengeSolvesTable";
import {Challenge} from "@/types/challenge";

export interface ChallengeModalProps {
    isOpen: boolean;
    onClose: () => void;
    disabled: boolean;
    selected: Challenge;
}

export default function ChallengeModal(props: ChallengeModalProps) {
    const getSolves = useChallenge().useChallengeSolvedBy(props.selected?.ID)

    const closeModal = () => {
        props.onClose();
    };

    if (!!props.selected) {
        return (
            <Modal
                onClose={closeModal}
                isOpen={props.isOpen}
                scrollBehavior="inside"
                size="xl"
                isCentered
                motionPreset="slideInBottom"
            >
                <ModalOverlay/>
                <ModalContent maxH="100%" minH="400px">
                    <ModalBody margin="0" padding="0">
                        <Tabs variant="enclosed">
                            <TabList margin="20px">
                                <Tab color="#211a52">Завдання</Tab>
                                <Tab color="#211a52">
                                    {getSolves?.data ? getSolves.data.length + (getSolves.data.length > 0 && getSolves.data.length < 5 ? " Рішення" : " Рішень") : "0 Рішень"}
                                </Tab>
                            </TabList>

                            <TabPanels>
                                <TabPanel>
                                    <ChallengeForm
                                        challenge={props.selected}
                                        disabled={props.disabled}
                                        onClose={closeModal}
                                    />
                                </TabPanel>
                                <TabPanel>
                                    <Flex maxH="600px">
                                        <ChallengeSolvesTable descriptionID={props.selected?.ID}/>
                                    </Flex>
                                </TabPanel>
                            </TabPanels>
                        </Tabs>
                    </ModalBody>
                </ModalContent>
            </Modal>
        )
    }
}
