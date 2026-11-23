# Sidor

Varje fil i `sidor/` blir en sida i Mötis, på adressen filens sökväg utan
`.md`: `sidor/integritet.md` är /integritet och `sidor/hjalp/moten.md`
är /hjalp/moten. En `index.md` hamnar på mappens adress
(`sidor/hjalp/index.md` är /hjalp).

Filen börjar med ett huvud:

```markdown
---
title: Integritetspolicy
description: En mening om sidan, för sökmotorer och förhandsvisningar.
updated: 2026-11-23
footer: 2
---
```

- `title` (krävs) blir sidans rubrik, så texten börjar på `##`, inte `#`.
- `updated` visas som "Senast uppdaterad" (ÅÅÅÅ-MM-DD).
- `footer` tar med sidan i sidfoten; talet bestämmer ordningen.

Länka mellan sidor med vanliga adresser, t.ex. `[integritetspolicyn](/integritet)`,
och till en rubrik med `#` och rubrikens text i små bokstäver med
bindestreck: `/integritet#dina-rattigheter`.

Sidorna byggs in i appen, så en ändring syns efter nästa driftsättning.
`corepack pnpm test` kontrollerar att alla sidor går att läsa.

Platshållare som behöver fyllas i står som `[FYLL I: …]`.
