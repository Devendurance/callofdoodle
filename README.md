# Call of Doodle (Doodle Strike)

A hand-drawn, mobile-first FPS that runs in the browser. Free-for-all against NPC bots, first to 20 points wins.
Includes profiles, XP and 50 levels with unlockable faces, inks and titles, settings, pause, and a scoreboard.

## Play locally

It is a static site with no build step:

```bash
npx serve .        # or: python3 -m http.server 4173
```

Open http://localhost:4173. On a phone, hold it in landscape.

## Deploy on Vercel

1. Vercel dashboard > Add New > Project > import this repository.
2. Framework preset: **Other**. Leave the build command and output directory empty.
3. Deploy. Every push to `main` redeploys automatically.

## Loadouts

Players pick 2 guns plus a lethal and a tactical in **Loadout** (main menu or pause menu). Gear unlocks by level:

| Class | Guns (unlock level) |
|---|---|
| Assault rifles | AK117 (1), Type 19 (6), BAL27 (15), AK-47 (24) |
| SMGs | USS9 (1), VMP (8), Switchblade X9 (12), Static-HV (20) |
| Snipers | DL Q33 (1), Koshka (10), Locus (18), Tundra (28) |
| Shotguns | HS0405 (3), BY15 (5), Striker (22), KRM-262 (32) |

Lethals: Frag (1), Sticky Doodle (4), Hot Sauce (9), Cluster Scribble (14), Paper Mine (19).
Tacticals: Ink Bomb (1), Flash Doodle (3), Eraser Shock (7), Snack Break (11).

Each gun has its own damage, range falloff, fire rate, magazine, reload, recoil, mobility and ADS speed (see `GUNS` in `data.js`). NPCs carry random guns from all four classes.

## HUD settings

Settings → HUD: overall size, button opacity, crosshair style and colour, toggles for kill feed / top 3 / keyboard hint, and **Move & resize controls**, which lets you drag every button and scale each one individually.

## Layout

- `index.html`, `style.css`: menus, HUD and touch controls
- `game.js`: game loop, player, match rules, UI
- `bots.js`: NPC AI
- `world.js`: map, collision, pathfinding
- `fx.js`, `audio.js`: effects and synthesized sound
- `data.js`: profiles, XP, levels, guns, equipment and loadouts (saved in the browser's localStorage)
- `three.module.min.js`: bundled three.js
- `docs/sketches/`: the original concept sketch and test screenshots
