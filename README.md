# The Quiet Floor

![Best Stealth Game](https://make.fun/badge/best-stealth-game-20261121-1759.svg)
![Rank](https://make.fun/badge/best-stealth-game-20261121-1759/rizkyptrp/best-stealth-game-20261121-1759-r2/rank.svg)
![Reward](https://make.fun/badge/best-stealth-game-20261121-1759/rizkyptrp/best-stealth-game-20261121-1759-r2/reward.svg)

A top-down 2D stealth game that runs entirely offline in a desktop browser.
You are **Wren**, a courier with light fingers, slipping through the Meridian
Archive at night. Three ledger pages sleep in the vaults, the night guards
walk their rounds with lanterns and long memories, and the service door only
opens once every page is yours. Take them all — and leave unseen.

## How to play

- **Move** — WASD or arrow keys.
- **Sneak** — hold Shift. Slower and quieter; guards spot you far more slowly.
- **Throw a pebble** — click the floor. Guards inside earshot walk over to
  investigate the sound. Use it to pull a patrol off its round.
- **Hide** — stand in the bushes. A guard cannot see you there unless he is
  nearly on top of you. Dark shadow patches slow suspicion too.
- **Pause** — P · **Restart floor** — R · **Mute** — M.

## The stealth

Every guard has a vision cone, a patrol beat you can learn, and a suspicion
meter that builds while you are in sight — faster up close, faster when you
run, slower in shadow and while sneaking. At half suspicion a guard grows
wary and walks over to look; at full suspicion he raises the alarm and
chases. Break line of sight and he searches the last place he saw you,
then gives up and returns to his round. Get caught, and the night is over.

Three floors, escalating: the Archive (2 guards), the Gallery (3 guards,
longer lanterns), the Vault (4 guards, no easy corner). Your rating at the
end of a floor is **Ghost** if no guard ever suspected you, **Shadow** if
you were seen but never caught.

## Sound

All sound is synthesized live with the Web Audio API — no audio files.
Footsteps pan and fade with distance, so you can hear where a guard is
before you see him; a questioning note when a guard grows suspicious, a
clashing sting when the alarm rises, a chime for every page taken, and a
low drone for the archive at night.

## Play it

```sh
node serve.ts   # then open http://localhost:8080
```

Static files only — `game/index.html` opens in any static server with no
network requests. Screenshot scenes: open `?shot=cover`,
`?shot=patrol`, `?shot=alarm`, or `?shot=victory` for a frozen, staged
render of the game's own code.

## Structure

- `game/main.js` — boot, game loop, screens, HUD, screenshot staging
- `game/levels.js` — the three floors: walls, crates, bushes, patrols
- `game/guards.js` — guard AI: patrol, suspicion, alert, investigate, return
- `game/player.js` — Wren: movement, sneaking, pebbles, pickups
- `game/render.js` — all canvas art, drawn in code
- `game/audio.js` — synthesized WebAudio sound
- `game/geometry.js` — collision and line-of-sight helpers
- `main.ts` — the make.fun entry program (copies `game/` and
  `screenshots/`, writes `dossier.json`)
