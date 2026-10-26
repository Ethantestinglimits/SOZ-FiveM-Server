export type PauseMenuData = {
    firstname: string;
    lastname: string;
    job: string | null;
    grade: string | null;
    onDuty: boolean;
    serverId: number;
};

export interface NuiPauseMenuMethodMap {
    Open: PauseMenuData;
    Close: never;
}
