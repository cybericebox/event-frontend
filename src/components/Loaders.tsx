import type React from 'react'
import LoadingSpin from "react-loading-spin";

export default function Loader() {
    return (
        <div
            className={"flex justify-center items-center w-full h-full"}
        >
            <LoadingSpin
                primaryColor="#211a52"
                size="100px"
            />
        </div>
    )
}