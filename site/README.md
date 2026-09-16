# site/

The public pages for Schema Studio. Plain HTML — no build step, no local assets, no shared
stylesheet. Each file stands alone.

They cross-link with the app: both pages have an **Open the app** action, and the app links back
from its start-screen footer and the `?` button in the toolbar.

| File | What it is |
| --- | --- |
| `index.html` | Landing page. What the tool is for, what it does, and the worked example. |
| `guide.html` | Full guide. Every feature, the JSON contract, and how to bring your own schema. |

## Running them

Open the files directly, or serve the folder:

```
python3 -m http.server -d site 8080
```

They need no build to work. `npm run build` also lists them as Vite entry points, so a build emits
`dist/index.html` (the app) plus `dist/site/index.html` and `dist/site/guide.html` — the bundle is
self-contained and the app's links to its own documentation resolve. Publishing the folder on its
own still works exactly as before.

Links between the app and these pages are relative (`site/guide.html` one way, `../index.html` the
other), so they resolve in dev, in `dist/`, and from the filesystem.

## How they are styled

Design tokens are copied from the app's own stylesheet (`src/styles.css` — the **paper** light
theme and the **slate** dark one; the app itself ships eight). Site and tool are meant to read as
one product, so if you restyle the app, restyle these too — the values here are a copy and will not
follow on their own.

Type is the platform's own UI face via `--sans` / `--mono`, the same stacks the app uses. These
pages used to pull IBM Plex from Google Fonts, which made them read as a different product from an
app that ships no webfont at all — and put a network request on pages describing a tool whose whole
pitch is that it makes none.

These pages also **follow the app's theme**. The app stores its choice under `schemastudio.theme`;
since these pages only have a light and a dark palette, the four dark app themes (slate, midnight,
carbon, pine) map to dark and the rest to light. Without that the two ran on independent
preferences and could disagree — the app in light Paper while the site rendered dark. The site's
own toggle still wins when the visitor has used it.

Theming follows the three-state pattern, which is easy to get wrong:

- light on bare `:root`
- dark declared **twice** — once behind `@media (prefers-color-scheme: dark)` guarded as
  `:root:not([data-theme='light'])`, once behind `:root[data-theme='dark']`

The default "system" setting stamps no attribute at all, so only the media query separates light
from dark for a visitor who has never toggled. **Never declare a colour only inside a media
query** — that is what produces one theme's text on the other theme's background.

Precedence, set by the inline script at the top of each page:

1. `ss-site-theme` — an explicit choice made with the toggle on these pages
2. `schemastudio.theme` — whatever theme the app is in, mapped to light or dark
3. `prefers-color-scheme` — the OS setting, via the media query

## Editing

`guide.html` carries its own copy of the token block, header chrome and theme script from
`index.html` — that is the price of each page standing alone with no shared stylesheet. If you
change the tokens in one, change them in the other, or the two pages drift.
