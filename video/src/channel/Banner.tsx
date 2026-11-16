// La bannière de la chaîne YouTube : 2560×1440, mais seule la zone centrale
// de 1546×423 est visible PARTOUT (téléphone compris). Tout ce qui compte y
// tient ; le reste n'est qu'ambiance (le motif de l'Ararat, le dégradé).
import React from "react";
import { AbsoluteFill } from "remotion";
import { Ararat, C, F } from "../brand";

export type BannerProps = { brand: string; tagline: string; url: string };

export const Banner: React.FC<BannerProps> = ({ brand, tagline, url }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse at 50% 120%, rgba(242,169,59,0.22), transparent 60%), ${C.basalt}`,
    }}
  >
    {/* Ambiance, hors zone sûre : un grand Ararat estompé à droite. */}
    <div style={{ position: "absolute", right: -60, bottom: -80, opacity: 0.06 }}>
      <Ararat size={900} />
    </div>
    {/* La zone sûre, centrée. */}
    <div
      style={{
        position: "absolute",
        left: (2560 - 1546) / 2,
        top: (1440 - 423) / 2,
        width: 1546,
        height: 423,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 56,
      }}
    >
      <Ararat size={250} />
      <div>
        <div
          style={{
            fontFamily: F.serif,
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: 150,
            lineHeight: 1,
            color: C.apricot,
          }}
        >
          {brand}
        </div>
        <div
          style={{
            fontFamily: F.mono,
            fontWeight: 700,
            fontSize: 40,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: C.cream,
            marginTop: 26,
          }}
        >
          {tagline}
        </div>
        <div style={{ fontFamily: F.mono, fontSize: 34, color: C.muted, marginTop: 16 }}>{url}</div>
      </div>
    </div>
  </AbsoluteFill>
);
