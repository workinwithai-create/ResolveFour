# ResolveFour

Four-bar resolution desk for bedroom producers and AI-music finishers.

AI tools and loop DAWs hold tension or slam sections. Session players resolve the harmony for four bars so the next section lands clean: piano arpeggios the tonic, upright walks home, kit settles, violin releases the tension tone.

Live samples only — FluidR3 acoustic grand, upright bass, nylon guitar, trumpet, violin, and acoustic kit from the PreEight sample CDN pinned to commit `d58301e4a494555f411a2afbc448b724136eee76`.

No oscillators. Audio never leaves the tab.

## Distinct from yesterday and the rest of the line

| Tool | Job |
| --- | --- |
| TagFour | Four-bar last-line tag |
| ModEight | Last-chorus key change |
| LiftTwo | Two-bar pre-hook lift |
| PreEight | Eight-bar pre-chorus climb |
| AfterHook | Eight bars after the hook |
| EndEight | Last eight bars |
| LastHook | Money chorus |
| TensionFour | Four bars of pedal hold while harmony moves, then release |
| HookLine | Four bars of a singable motif |
| **ResolveFour** | Four bars of clean harmonic resolution after tension |

Yesterday’s ship was HookLine / TensionFour. ResolveFour is the missing clean landing.

## Pricing recommendation

One-time **$27** on Lemon Squeezy (Merchant of Record). Mirror on Gumroad.

This is a finite desk, not a cloud meter. Do not subscribe. Forge Pass stays the recurring cloud bundle for MixForge / AuraMix / etc.

**Current app is free.** No license gate. MIT. A priced build would need a Lemon Squeezy or Gumroad key check (or WorkinWithAI entitlement).

Best place to sell: Lemon Squeezy + Gumroad mirror. Not the App Store. Not Plugin Boutique for a browser desk.

## Samples

Pinned commit SHA only. Never `@main` or `@gh-pages`.

## Export

Default bounce is 48 kHz, 24-bit stereo.

At 92 BPM and 8 bars the loop file is exactly 1,001,739 samples (`Math.round(8 * 4 * 60 / 92 * 48000)`), first downbeat at sample 0. Tail folded for seamless loop. Peak ≤ −1 dBFS.

Filenames: `resolvefour-recipe-<bpm>bpm-<key>.wav` and matching `.mid`.

## License

MIT. workinwithai-create.

## Acceptance (section 9)

1. Export at 92 BPM, 8 bars, 48 kHz → exactly 1,001,739 samples; first transient at sample 0.
2. Import at bar 1 of a 92 BPM DAW session and loop 4× → no clicks, no drift.
3. Play, switch tab 30 s, return → stopped cleanly, no stacked notes.
4. Change recipe / mutes / BPM while playing → heard within one bar, no restart.
5. Block sample host + reload → UI names missing instruments.
6. Longest held note sustains to end.
7. Grep: no @main / @gh-pages, no Math.random in export path, voice names match samples.
