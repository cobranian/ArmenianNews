// Types de timing.mjs (JS pur, pour que node --test le lise sans compilation).
export type VoiceLine = { file: string; seconds: number }

export declare const LEAD: number
export declare const TAIL: number
export declare function sceneFrames(seconds: number, fps: number): number
export declare function outroFrames(seconds: number, fps: number): number
export declare function narratedDuration(lines: VoiceLine[], fps: number, fade: number): number
export declare function speechWindows(lines: VoiceLine[], fps: number, fade: number): [number, number][]
export declare function maxSpeechSeconds(fps: number): number
export declare function fitsScene(seconds: number, fps: number): boolean
