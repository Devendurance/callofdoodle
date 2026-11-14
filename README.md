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

## iOS app / TestFlight

The same game ships as a native iOS app, **Call of Doodle** (bundle id `com.devendurance.callofdoodle`), using
[Capacitor](https://capacitorjs.com). The app bundles the game files offline, is locked to landscape, hides the
status bar and uses native haptics. The web version on Vercel is unchanged.

- `capacitor.config.json`: app id, name, web folder
- `ios/`: the Xcode project (Swift Package Manager, iOS 15+, iPhone and iPad)
- `scripts/copy-web.mjs`: copies the game into `www/` for the app (`npm run ios:sync` copies and syncs to Xcode)
- `scripts/make-icons.mjs`: regenerates the app icon and splash screen
- `.github/workflows/ios.yml`: builds on GitHub's macOS machines; a simulator build runs on PRs that touch the iOS side

### One-time setup (needs a paid Apple Developer account, $99/year)

1. **Register the app id.** [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list) > Identifiers > + > App IDs > App, bundle id `com.devendurance.callofdoodle`.
2. **Create the app record.** [App Store Connect](https://appstoreconnect.apple.com) > Apps > + > New App: platform iOS, name "Call of Doodle" (pick another if taken), bundle id from step 1, any SKU.
3. **Create an API key.** App Store Connect > Users and Access > Integrations > App Store Connect API > Team Keys > +, access **App Manager**. Download the `.p8` file (only downloadable once) and note the **Key ID** and **Issuer ID**.
4. **Find your Team ID** at [developer.apple.com/account](https://developer.apple.com/account) > Membership details.
5. **Add four GitHub secrets** (repo > Settings > Secrets and variables > Actions > New repository secret):
   - `ASC_KEY_P8`: the whole contents of the `.p8` file
   - `ASC_KEY_ID`: the Key ID
   - `ASC_ISSUER_ID`: the Issuer ID
   - `APPLE_TEAM_ID`: the Team ID

### Ship a build to TestFlight

1. GitHub > **Actions** > **iOS** > **Run workflow** (leave "Sign and upload" ticked). It takes about 10 minutes.
   Xcode creates the signing certificate and profile automatically using the API key.
2. After Apple processes it (5-30 minutes) the build appears in App Store Connect > your app > **TestFlight**.
   Answer the export-compliance question if asked (the app declares no non-exempt encryption, so usually it isn't).
3. **Internal testers** (up to 100 people on your App Store Connect team): TestFlight > Internal Testing > + > add them. They get it right away.
4. **External testers** (up to 10,000, anyone with an email or a public link): TestFlight > External Testing > + group, add the build, fill in the test info. The first build needs Apple's beta review (usually under a day); then turn on the public link.
5. Testers install the **TestFlight** app from the App Store and accept the invite.

Each run gets a new build number automatically. To change the version shown to players (1.0), edit `MARKETING_VERSION` in Xcode or `ios/App/App.xcodeproj/project.pbxproj`.

### Building on a Mac instead

```bash
npm ci
npm run ios:sync
npm run ios:open      # opens Xcode: pick your team under Signing & Capabilities, then Product > Archive
```

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
- `ios/`, `capacitor.config.json`, `scripts/`: the iOS app (see above)
- `docs/sketches/`: the original concept sketch and test screenshots
