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

## Layout

- `index.html`, `style.css`: menus, HUD and touch controls
- `game.js`: game loop, player, match rules, UI
- `bots.js`: NPC AI
- `world.js`: map, collision, pathfinding
- `fx.js`, `audio.js`: effects and synthesized sound
- `data.js`: profiles, XP and levels (saved in the browser's localStorage)
- `three.module.min.js`: bundled three.js
- `docs/sketches/`: the original concept sketch and test screenshots
