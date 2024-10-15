"use client";
import {Button, Center, Text, VStack} from "@chakra-ui/react";
import type React from "react";
import "@/app/globals.css"

export interface ChallengeTileProps {
    name: string;
    points: number;
    solved: boolean;
    onClick: () => void;
}


export default function ChallengeTile(props: ChallengeTileProps) {
    return (
        <Button
            height="110px"
            width="100%"
            className="challenge-container"
            bg={!props.solved ? "#211a52" : "#5caf8d"}
            _hover={!props.solved ? {bg: "#18123a"} : {bg: "#4c9a79"}}
            onClick={props.onClick}
        >
            <VStack
                // color="#dfdfe3"
                fontWeight="400"
            >
                <Center
                    w="100%"
                    // color="#dfdfe3"
                    fontWeight="400"
                >
                    <VStack spacing="15px">
                        <Text
                            w="100%"
                            whiteSpace="pre-line"
                            wordBreak="break-word"
                            fontSize="14px"
                            color="white"
                        >
                            {props.name}
                        </Text>
                        <Text fontSize="16px" color="white">{props.points}</Text>
                    </VStack>
                </Center>
            </VStack>
        </Button>
    );
}
