// Time decay (mode 3) has no floor: the server stores 100, so the UI hides the
// field and always sends 100 for it.
export function withTimeDecayFloor<T extends {Mode: number; FloorAtPercent: number}>(value: T): T {
    return value.Mode === 3 ? {...value, FloorAtPercent: 100} : value;
}

export function scoringFloorVisible(mode: number): boolean {
    return mode === 1 || mode === 2;
}
