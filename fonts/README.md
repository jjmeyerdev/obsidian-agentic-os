# Bundled fonts

The plugin registers eight `.woff2` files from this folder as `@font-face` at runtime
(`injectFonts()` in `main.ts`, via `getResourcePath`). They are **not** committed
(binary). Download them once with the commands below — the left side is the source URL
(Fontsource on jsDelivr), the right side is the local filename the code expects.

If a file is missing, the pane still works: it falls back to the host
sans-serif / monospace stack.

## Download (run from this `fonts/` folder)

```sh
# JetBrains Mono — 400 / 500 / 600 / 700
curl -L -o JetBrainsMono-Regular.woff2  https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2
curl -L -o JetBrainsMono-Medium.woff2   https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2
curl -L -o JetBrainsMono-SemiBold.woff2 https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2
curl -L -o JetBrainsMono-Bold.woff2     https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2

# Space Grotesk — 400 / 500 / 600 / 700
curl -L -o SpaceGrotesk-Regular.woff2  https://cdn.jsdelivr.net/npm/@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2
curl -L -o SpaceGrotesk-Medium.woff2   https://cdn.jsdelivr.net/npm/@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2
curl -L -o SpaceGrotesk-SemiBold.woff2 https://cdn.jsdelivr.net/npm/@fontsource/space-grotesk/files/space-grotesk-latin-600-normal.woff2
curl -L -o SpaceGrotesk-Bold.woff2     https://cdn.jsdelivr.net/npm/@fontsource/space-grotesk/files/space-grotesk-latin-700-normal.woff2
```

Both families are licensed under the SIL Open Font License.

> Why runtime registration: Obsidian injects a plugin's `styles.css` into the document
> head, where relative `url('fonts/...')` paths resolve against the app base (not the
> plugin folder) and fail to load. `injectFonts()` in `main.ts` sidesteps this by
> resolving each file through `app.vault.adapter.getResourcePath(...)` to a valid
> `app://` URL, so `styles.css` itself carries no `@font-face`.
