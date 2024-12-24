'use client'

import React, {useEffect, useState} from "react";
import {
    Box,
    Center,
    Drawer,
    DrawerBody,
    DrawerCloseButton,
    DrawerContent,
    DrawerHeader,
    DrawerOverlay,
    Flex,
    HStack,
    IconButton,
    useDisclosure,
} from "@chakra-ui/react";
import {FiLogIn, FiLogOut} from "react-icons/fi";
import {FaBookOpen} from "react-icons/fa";
import {MdOutlinedFlag} from "react-icons/md";
import {RiTeamLine, RiUserSettingsLine,} from "react-icons/ri";
import {SlGraph} from "react-icons/sl";
import {HamburgerIcon} from "@chakra-ui/icons";
import NavItem from "./NavItem";
import LabButton from "./LabButton";
import Logo from "../Logo"
import {ClientAuthentication} from "@/hooks/auth";
import {WithTeamParticipation, WithTeam} from "@/components/team/WithTeam";
import {useRouter} from "next/navigation";
import {WithEvent, WithScoreBoard} from "@/components/event/WithEvent";
import {signOut} from "@/api/authAPI";


export default function NavBar() {
    const {isOpen, onOpen, onClose} = useDisclosure();
    const [navSize, changeNavSize] = useState("small"); // Used for the menu button which is also commented out below
    const PlatformName = "Cyber ICE Box";
    const router = useRouter();

    const newSignOut = () => {
        signOut().then(() => {
            router.refresh()
        });
        onClose()
    };


    const scrolledToTop = false//useSelector((state) => state.generic.scrolledToTop);

    const [width, setWindowWidth] = useState(0);
    const updateDimensions = () => {
        const width = window.innerWidth;
        setWindowWidth(width);
    };

    useEffect(() => {
        updateDimensions();

        window.addEventListener("resize", updateDimensions);
        if (width >= 1700) {
            changeNavSize("large");
        } else if (width >= 1050) {
            changeNavSize("medium");
        } else {
            changeNavSize("small");
        }
        return () => window.removeEventListener("resize", updateDimensions);
    });

    return (
        <Flex
            backgroundColor={scrolledToTop ? "#fff" : "#211a52"}
            pos="sticky"
            top="0"
            h="75px"
            w="100%"
            flexDir="row"
            fontWeight="bold"
            bg={scrolledToTop ? "transparent" : "solid"}
            justifyContent="space-between"
            zIndex="1100"
        >
            <Flex
                flexDir="row"
                w="fit-content"
                marginLeft={navSize === "small" ? "10px" : "25px"}
                alignItems="center"
                h="inherit"
                color={scrolledToTop ? "#54616e" : "#dfdfe3"}
                position="sticky"
                fontSize={navSize === "small" ? "30px" : "35px"}
                as="nav"
                top="0"
                fontFamily={"Bungee"}
            >
                <Logo height={75}/>
                <div
                    className={"text-2xl sm:text-3xl font-bold text-white"}
                >
                    {PlatformName}
                </div>
            </Flex>

            <Flex
                flexDir="row"
                w="fit-content"
                display={navSize === "small" ? "none" : "flex"}
                top="0"
                margin="auto"
                alignItems="center"
                as="nav"
            >
                <HStack spacing="20px">
                    <NavItem
                        navSize={navSize}
                        displayTooltip={false}
                        displayTitle

                        icon={MdOutlinedFlag}
                        title="Завдання"
                        to="/challenges"
                    />
                    <WithScoreBoard>
                        <NavItem
                        navSize={navSize}
                        displayTooltip={false}
                        displayTitle

                        icon={SlGraph}
                        title="Результати"
                        to="/scoreboard"
                    />
                    </WithScoreBoard>
                    <NavItem
                        navSize={navSize}
                        displayTooltip={false}
                        displayTitle

                        icon={FaBookOpen}
                        title="Правила"
                        to="/faq"
                    />
                </HStack>
            </Flex>

            <Flex
                flexDir="row"
                w="fit-content"
                right="0"
                m="15.639px 20px 15.639px 0px"
                position="sticky"
                alignItems="center"
                as="nav"
                top="0"
            >
                {ClientAuthentication().IsAuthenticated ? (
                    <>
                        <WithEvent>
                    <WithTeam>
                        <LabButton
                            display={navSize !== "small" ? "flex" : "none"}
                        />
                        </WithTeam></WithEvent>

                        <IconButton
                            marginLeft="10px"
                            bg={scrolledToTop ? "#211a52" : "#dfdfe3"}
                            color={scrolledToTop ? "white" : "#54616e"}
                            _hover={scrolledToTop ? {bg: "#18123a"} : {bg: "#c8c8d0"}}
                            icon={<HamburgerIcon/>}
                            display={navSize === "small" ? "flex" : "none"}
                            onClick={onOpen}
                            aria-label={""}
                        />
                        <HStack
                            marginLeft="10px"
                            spacing="10px"
                            display={navSize === "small" ? "none" : "flex"}
                        >
                            {
                                <WithEvent>
                                <WithTeamParticipation>
                                    <NavItem
                                        navSize={navSize}
                                        displayTooltip={false}

                                        icon={RiTeamLine}
                                        displayTitle
                                        title="Команда"
                                        to="/team"
                                    />
                                </WithTeamParticipation>
                                </WithEvent>

                            }
                            <NavItem
                                navSize={navSize}
                                displayTooltip={false}

                                icon={RiUserSettingsLine}
                                title="Профіль"
                                displayTitle
                                to={`/profile`}
                                external
                            />
                            <NavItem
                                navSize={navSize}

                                displayTooltip={true}
                                icon={FiLogOut}
                                title="Вийти"
                                to="/"
                                customClickEvent={newSignOut}
                            />
                        </HStack>
                    </>
                ) : (
                    <>
                        <IconButton
                            marginLeft="10px"
                            bg={scrolledToTop ? "#211a52" : "#dfdfe3"}
                            color={scrolledToTop ? "white" : "#54616e"}
                            _hover={scrolledToTop ? {bg: "#18123a"} : {bg: "#c8c8d0"}}
                            icon={<HamburgerIcon/>}
                            display={navSize === "small" ? "flex" : "none"}
                            onClick={onOpen}
                            aria-label={""}
                        />
                        <Box
                            display={navSize === "small" ? "none" : "flex"}
                        >
                            <NavItem
                                navSize={navSize}
                                displayTooltip={true}
                                icon={FiLogIn}
                                title="Увійти"
                                to={`/sign-in`}
                                external
                            />
                        </Box>
                    </>
                )}
                <Drawer placement="top" onClose={onClose} isOpen={isOpen}>
                    <DrawerOverlay/>
                    <DrawerContent color={"#dfdfe3"} backgroundColor={"#211a52"}>
                        <DrawerCloseButton/>
                        <DrawerHeader fontSize="30px">
                            <Flex
                                flexDir="row"
                                alignItems="center"
                                marginBottom="10px"
                                as="nav"
                                top="0"
                                fontFamily={"Bungee"}
                            >
                                <Logo height={75} onClick={onClose}/>
                                <div
                                    className={"text-2xl sm:text-3xl font-bold text-white"}
                                >
                                        {PlatformName}
                                </div>
                            </Flex>
                        </DrawerHeader>
                        <DrawerBody>
                            {ClientAuthentication().IsAuthenticated && (
                                <Center>
                                <WithEvent>
                                    <WithTeam>
                                    <LabButton
                                        display={navSize === "small" ? "flex" : "none"}
                                        inDrawer
                                    />
                                    </WithTeam>
                                </WithEvent>
                                </Center>

                            )}
                            <Center width="fit-content" margin="auto">
                                <NavItem
                                    navSize={"large"}

                                    displayTooltip={false}
                                    displayTitle
                                    icon={MdOutlinedFlag}
                                    title="Завдання"
                                    to="/challenges"
                                    customClickEvent={onClose}
                                />
                            </Center>
                            <Center width="fit-content" margin="auto">
                                <WithScoreBoard>
                                <NavItem
                                    navSize={"large"}

                                    displayTooltip={false}
                                    displayTitle
                                    icon={SlGraph}
                                    title="Результати"
                                    to="/scoreboard"
                                    customClickEvent={onClose}
                                />
                                </WithScoreBoard>
                            </Center>
                            <Center width="fit-content" margin="auto">
                                <NavItem
                                    navSize={"large"}

                                    displayTooltip={false}
                                    displayTitle
                                    icon={FaBookOpen}
                                    title="Правила"
                                    to="/faq"
                                    customClickEvent={onClose}
                                />
                            </Center>
                            {ClientAuthentication().IsAuthenticated ? (
                                <>
                                    <Center width="fit-content" margin="auto">
                                    <WithEvent>
                                        <WithTeamParticipation><NavItem
                                            navSize={"large"}
                                            icon={RiTeamLine}
                                            title="Команда"
                                            to="/team"
                                            displayTitle
                                            customClickEvent={onClose}
                                        /></WithTeamParticipation>
                                    </WithEvent>
                                    </Center>
                                    <HStack
                                        spacing="10px"
                                        width="300px"
                                        margin="auto"
                                        marginTop="30px"
                                        display={navSize !== "large" ? "flex" : "none"}
                                    >
                                        <NavItem
                                            navSize={"large"}
                                            icon={RiUserSettingsLine}
                                            title="Профіль"
                                            to={`/profile`}
                                            displayTitle
                                            customClickEvent={onClose}
                                            external
                                        />
                                        <NavItem
                                            navSize={"large"}
                                            displayTitle
                                            icon={FiLogOut}
                                            title="Вийти"
                                            to="/"
                                            customClickEvent={newSignOut}
                                        />
                                    </HStack>
                                </>
                            ) : (
                                <Center width="fit-content" margin="auto">
                                    <NavItem
                                        navSize={"large"}
                                        displayTitle
                                        displayTooltip={true}
                                        icon={FiLogIn}
                                        title="Увійти"
                                        to={`/sign-in`}
                                        customClickEvent={onClose}
                                        external
                                    />
                                </Center>

                            )}
                        </DrawerBody>
                    </DrawerContent>
                </Drawer>
            </Flex>
        </Flex>
    );
}
