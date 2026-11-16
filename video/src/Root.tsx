import React from "react";
import { Composition, Folder, Still } from "remotion";
import { FPS, GarniShort, garniDuration } from "./garni/GarniShort";
import { Banner } from "./channel/Banner";
import { SHORTS } from "./shorts/all";
import { ShortVideo, shortDuration } from "./shorts/ShortVideo";

// Shorts : 1080×1920, 30 i/s. Une composition par langue — le .ch publie en
// français, allemand et italien, le .org en anglais, arménien, russe et espagnol.
export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="Shorts">
      <Composition
        id="GarniFr"
        component={GarniShort}
        defaultProps={{ lang: "fr" as const }}
        durationInFrames={garniDuration("fr")}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="GarniEn"
        component={GarniShort}
        defaultProps={{ lang: "en" as const }}
        durationInFrames={garniDuration("en")}
        fps={FPS}
        width={1080}
        height={1920}
      />
      {/* hy, ru et es : chaîne Armenia News (le .org) ; de et it : Arménie Info (le .ch). */}
      {(["hy", "ru", "de", "it", "es"] as const).map((lang) => (
        <Composition
          key={lang}
          id={`Garni${lang[0].toUpperCase()}${lang[1]}`}
          component={GarniShort}
          defaultProps={{ lang }}
          durationInFrames={garniDuration(lang)}
          fps={FPS}
          width={1080}
          height={1920}
        />
      ))}
    </Folder>
    {/* Un Short par article Culture (src/shorts/data/, puis scripts/sync.mjs).
        Identifiant : Fr-, En-, Hy-, Ru-, De-, It- et Es-<slug> (Remotion n'accepte ni accent ni
        espace, et le tiret du slug passe). Seules les langues dont sync.mjs a
        trouvé le short.<lang>.json sont déclarées : un article neuf peut
        n'avoir que le français, et shortDuration planterait sur les autres. */}
    <Folder name="Articles">
      {SHORTS.flatMap((s) =>
        (["fr", "en", "hy", "ru", "de", "it", "es"] as const).filter((lang) => lang in s).map((lang) => (
          <Composition
            key={`${lang}-${s.slug}`}
            id={`${lang[0].toUpperCase()}${lang[1]}-${s.slug}`}
            component={ShortVideo}
            defaultProps={{ slug: s.slug, lang }}
            durationInFrames={shortDuration(s.slug, lang)}
            fps={FPS}
            width={1080}
            height={1920}
          />
        )),
      )}
    </Folder>
    <Folder name="Chaine">
      <Still
        id="BanniereCh"
        component={Banner}
        width={2560}
        height={1440}
        defaultProps={{ brand: "Arménie Info", tagline: "Actualités arméniennes", url: "armenieinfo.ch" }}
      />
      <Still
        id="BanniereOrg"
        component={Banner}
        width={2560}
        height={1440}
        defaultProps={{ brand: "Armenia News", tagline: "Armenian news, events and culture", url: "armenianews.org" }}
      />
    </Folder>
  </>
);
