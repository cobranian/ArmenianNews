// Types de slides.mjs.
export declare function slideImages(nFacts: number, nImages: number): number[]
export declare function slideFocus(image: { width?: number; height?: number } | undefined, factFocus: string | undefined): string | undefined
export type Box = { top: number; left: number; width: number; height: number }
export declare const FRAME_ZONE: Box
export declare const TEXT_TOP: number
export declare function frameBox(image: { width?: number; height?: number } | undefined): Box
