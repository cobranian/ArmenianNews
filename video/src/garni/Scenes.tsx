import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Ararat, C, F } from "../brand";
import type { Copy, Fact } from "./content";

// La photo et la hauteur de la planche viennent du Copy ; Garni garde ses
// valeurs d'origine, pour que sa vidéo publiée reste reproductible.
const photoOf = (copy: Copy) => staticFile(copy.photo ?? "garni.jpg");
const plateOf = (copy: Copy) => copy.plate ?? 690;

// Réglages par écriture, repris de global.css (html:lang(hy) / html:lang(ru)) :
// l'approche négative des titres latins referme les contrepoinçons de
// l'arménien et brouille le rythme du cyrillique ; l'arménien, avec ses
// jambages, demande plus d'interlignage. Le français et l'anglais gardent
// leurs valeurs d'origine (null = inchangé).
const SCRIPT = {
  hy: { titleTrack: "0em", titleLeading: 1.16, capsTrack: "0.06em", textLeading: 1.42 },
  ru: { titleTrack: "-0.005em", titleLeading: 1.08, capsTrack: "0.1em", textLeading: 1.36 },
} as const;
const tune = (copy: Copy) => (copy.lang === "hy" || copy.lang === "ru" ? SCRIPT[copy.lang] : null);

// Une entrée : fondu + légère montée, décalée de `delay` secondes.
const useEnter = (delay: number) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opts = {
    extrapolateLeft: "clamp" as const,
    extrapolateRight: "clamp" as const,
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  };
  const start = delay * fps;
  return {
    opacity: interpolate(frame, [start, start + 0.5 * fps], [0, 1], opts),
    translate: interpolate(frame, [start, start + 0.7 * fps], ["0px 40px", "0px 0px"], opts),
  };
};

// Le fond : la photo floutée et assombrie, plein cadre. Le flou cache
// l'agrandissement (la photo ne fait que 1200 px de large).
export const Backdrop: React.FC<{ focus?: string; src: string }> = ({ focus = "50% 50%", src }) => (
  <AbsoluteFill style={{ backgroundColor: C.basalt }}>
    <Img
      src={src}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: focus,
        filter: "blur(38px) brightness(0.32) saturate(0.9)",
        scale: "1.25",
      }}
    />
  </AbsoluteFill>
);

// Le bandeau du haut et le crédit du bas, communs à toutes les scènes.
export const Chrome: React.FC<{ copy: Copy }> = ({ copy }) => (
  <>
    <div
      style={{
        position: "absolute",
        top: 110,
        left: 80,
        right: 80,
        display: "flex",
        alignItems: "center",
        gap: 22,
      }}
    >
      <Ararat size={64} />
      <div
        style={{
          fontFamily: F.mono,
          fontWeight: 700,
          fontSize: 34,
          letterSpacing: tune(copy)?.capsTrack ?? "0.14em",
          textTransform: "uppercase",
          color: C.apricot,
        }}
      >
        {copy.brand} · {copy.section}
      </div>
    </div>
  </>
);

// Le crédit photo (CC BY-SA : l'auteur et la licence doivent être cités),
// juste sous la planche — en bas, l'interface des Shorts le masquerait.
const Credit: React.FC<{ copy: Copy }> = ({ copy }) => (
  <div
    style={{
      position: "absolute",
      top: 250 + plateOf(copy) + 28,
      left: 80,
      right: 80,
      fontFamily: F.mono,
      fontSize: 21,
      color: C.muted,
      lineHeight: 1.3,
    }}
  >
    {copy.credit}
  </div>
);

// « Ier » se lit « ler » dans ces polices : on compose l'ordinal en exposant.
const typo = (s: string) =>
  s.split(/\b(Ier)\b/).map((part, i) =>
    part === "Ier" ? (
      <React.Fragment key={i}>
        I<sup style={{ fontSize: "0.6em", lineHeight: 0 }}>er</sup>
      </React.Fragment>
    ) : (
      part
    ),
  );

export const FactScene: React.FC<{ fact: Fact; copy: Copy; first?: boolean }> = ({ fact, copy, first = false }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // La première scène est le crochet : son titre est là dès l'image 0.
  const eyebrow = useEnter(first ? 0 : 0.2);
  const title = useEnter(first ? 0 : 0.4);
  const text = useEnter(first ? 0.5 : 0.9);
  const t = tune(copy);

  return (
    <AbsoluteFill>
      <Backdrop focus={fact.focus} src={photoOf(copy)} />

      {/* La planche photo : la même image, recadrée et en lent travelling. */}
      <div
        style={{
          position: "absolute",
          top: 250,
          left: 80,
          width: 920,
          height: plateOf(copy),
          overflow: "hidden",
          borderRadius: 6,
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
          outline: `2px solid ${C.apricotDeep}`,
          outlineOffset: 10,
        }}
      >
        <Img
          src={photoOf(copy)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: fact.focus ?? "50% 50%",
            scale: interpolate(frame, [0, durationInFrames], [1.0, 1.14], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        />
      </div>

      <Chrome copy={copy} />
      <Credit copy={copy} />

      <div style={{ position: "absolute", top: 250 + plateOf(copy) + 110, left: 80, right: 80 }}>
        <div
          style={{
            ...eyebrow,
            fontFamily: F.mono,
            fontWeight: 700,
            fontSize: 40,
            letterSpacing: t?.capsTrack ?? "0.12em",
            textTransform: "uppercase",
            color: C.apricot,
            marginBottom: 26,
          }}
        >
          {typo(fact.eyebrow)}
        </div>
        <div
          style={{
            ...title,
            fontFamily: F.serif,
            fontWeight: 600,
            fontSize: fact.big ? 118 : 100,
            lineHeight: t?.titleLeading ?? 1.04,
            letterSpacing: t?.titleTrack ?? "-0.015em",
            color: C.cream,
            marginBottom: 38,
          }}
        >
          {typo(fact.title)}
        </div>
        <div
          style={{
            ...text,
            fontFamily: F.sans,
            fontSize: 48,
            lineHeight: t?.textLeading ?? 1.36,
            color: C.cream,
            opacity: text.opacity * 0.86,
          }}
        >
          {typo(fact.text)}
        </div>
      </div>

    </AbsoluteFill>
  );
};

export const Outro: React.FC<{ copy: Copy }> = ({ copy }) => {
  const mark = useEnter(0);
  const kicker = useEnter(0.25);
  const title = useEnter(0.45);
  const url = useEnter(0.8);
  const t = tune(copy);
  return (
    <AbsoluteFill>
      <Backdrop src={photoOf(copy)} />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          textAlign: "center",
          padding: "0 80px",
        }}
      >
        <div style={{ ...mark, marginBottom: 60 }}>
          <Ararat size={220} />
        </div>
        <div
          style={{
            ...kicker,
            fontFamily: F.mono,
            fontWeight: 700,
            fontSize: 42,
            letterSpacing: t?.capsTrack ?? "0.12em",
            textTransform: "uppercase",
            color: C.apricot,
            marginBottom: 28,
          }}
        >
          {copy.outro.kicker}
        </div>
        <div
          style={{
            ...title,
            fontFamily: F.serif,
            fontWeight: 600,
            fontSize: 108,
            lineHeight: t?.titleLeading ?? 1.05,
            color: C.cream,
            marginBottom: 70,
          }}
        >
          {copy.outro.title}
        </div>
        <div
          style={{
            ...url,
            fontFamily: F.mono,
            fontWeight: 700,
            fontSize: 52,
            color: C.basalt,
            backgroundColor: C.apricot,
            padding: "22px 40px",
            borderRadius: 999,
          }}
        >
          {copy.outro.url}
        </div>
      </AbsoluteFill>
      <Chrome copy={copy} />
    </AbsoluteFill>
  );
};
