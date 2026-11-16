import React from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { COPY, type Lang } from "./content";
import { FactScene, Outro } from "./Scenes";
import { ShortMusic } from "../shorts/music";

export const FPS = 30;
export const SCENE = 6 * FPS; // une scène de fait
export const OUTRO = 5 * FPS;
export const FADE = 12; // fondu entre deux scènes

// Durée totale : les fondus font chevaucher les scènes, d'où la soustraction.
export const garniDuration = (lang: Lang) => {
  const n = COPY[lang].facts.length;
  return n * SCENE + OUTRO - n * FADE;
};

export const GarniShort: React.FC<{ lang: Lang }> = ({ lang }) => {
  const copy = COPY[lang];
  return (
    <>
      <ShortMusic slug="temple-paien-de-garni" />
      <TransitionSeries>
        {copy.facts.map((fact, i) => (
          <React.Fragment key={i}>
            <TransitionSeries.Sequence durationInFrames={SCENE} name={`Fait ${i + 1}`}>
              <FactScene fact={fact} copy={copy} first={i === 0} />
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE })} />
          </React.Fragment>
        ))}
        <TransitionSeries.Sequence durationInFrames={OUTRO} name="Fin">
          <Outro copy={copy} />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </>
  );
};
