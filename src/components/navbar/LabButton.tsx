'use client'
import {Button, Flex, Link, Text} from "@chakra-ui/react";
import type React from "react";
import {useTeam} from "@/hooks/useTeam";

export interface LabButtonProps {
    display: "flex" | "none";
    inDrawer?: boolean;
}

export default function LabButton({display, inDrawer}: LabButtonProps) {
    const getVPNConfig = useTeam().useGetVPNConfig();

    const createFileFromString = (text: string) => {
        console.log(text)
        const element = document.createElement("a");
        const file = new Blob([text], {type: 'text/plain'});
        element.href = URL.createObjectURL(file);
        element.download = `${window.location.hostname.split(".")[0]}-wireguard.conf`;
        element.click();
        URL.revokeObjectURL(element.href);
    }

    const DownloadWgConfig = () => {
        getVPNConfig.refetch()
            .then((res) => {
                if (res.data) {
                    createFileFromString(res.data)
                }
            })
    }

    return (
            <Flex display={display}>
                <Link
                    target="_blank"
                    _hover={{textDecor: "none"}}
                >
                    <Button
                        backgroundColor={inDrawer ? "#dfdfe3" : "#54616e"}
                        color={inDrawer ? "#54616e" : "#dfdfe3"}
                        _hover={
                            inDrawer
                                ? {backgroundColor: "#c8c8d0"}
                                : {backgroundColor: "#434d56"}
                        }
                        onClick={() => DownloadWgConfig()}
                        fontSize={"sm"}
                    >
                        <Text>Під&apos;єднатись до лабораторії</Text>
                    </Button>
                </Link>
            </Flex>
    );
}


