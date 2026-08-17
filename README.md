# dru·uly

Personal site — portfolio and blog. Plain HTML, CSS and JavaScript. No build
step, no dependencies, no framework. Open `index.html` in a browser and it works.

---

## Running it

The JS is written as ES modules, and browsers block modules over `file://`.
So serve the folder rather than double-clicking the file:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Everything except the JS (layout, type, colour, hover states) still renders fine
straight from `file://` if you just want a quick look.

---

## Structure

```
.
├── index.html              home — hero, statement, selected work, roll, recent writing
├── work.html               project index + tag filter + archive list
├── writing.html            writing index, grouped by year
├── about.html              bio + colophon
│
├── posts/
│   └── post-one.html       ← article template. Copy this for each new post.
│
├── projects/
│   └── project-one.html    ← case-study template. Copy this for each new project.
│
└── assets/
    ├── css/
    │   ├── tokens.css      colour, type scale, spacing, motion. Start here.
    │   ├── base.css        reset + bare HTML element defaults
    │   ├── layout.css      containers, grid, header, footer
    │   ├── components.css  wordmark, cards, index rows, frames, marquee, tags
    │   └── pages.css       hero, article, about, filters — page-specific only
    │
    ├── js/
    │   ├── main.js         the only script any page loads; boots the rest
    │   ├── nav.js          scrolled header + mobile menu + current-page marking
    │   ├── reveal.js       fade-in-on-scroll (data-reveal)
    │   ├── media.js        viewport-gated video loops, hover-play, load fades
    │   └── filter.js       tag filtering on work.html
    │
    ├── media/
    │   ├── img/            stills, portraits, og.jpg
    │   └── video/          looping clips (.mp4 + .webm)
    │
    └── fonts/              self-hosted webfonts, if you ever add any
```

The CSS files must load in that order — `tokens.css` defines the variables the
rest of them read.

---

## Adding a post

1. Copy `posts/post-one.html` to `posts/your-slug.html`.
2. Change `<title>`, the `<h1 class="article__title">`, and the `article__meta` line.
3. Write the body inside `<div class="prose">` using plain `<p>`, `<h2>`, `<ul>`,
   `<blockquote>`, `<figure>` — no classes needed, it's all styled already.
4. Add a row to `writing.html`:

```html
<a class="index__row" href="posts/your-slug.html">
  <span class="index__date">06.02</span>
  <span class="index__title">Your title</span>
  <span class="index__kind">Essay</span>
</a>
```

## Adding a project

Same idea with `projects/project-one.html`, then add a card to `work.html`.
The `data-tags` attribute on the card is what the filter buttons match against —
give it any space-separated tags, and add a button with a matching `data-filter`.

---

## Adding media

Every image and video goes inside a `.frame`, which holds its aspect ratio so
the page never jumps while things load:

```html
<div class="frame frame--wide">
  <img src="assets/media/img/thing.jpg" alt="" data-fade loading="lazy">
</div>
```

Ratios: `.frame` is 4:3 by default; add `--wide` (16:9), `--square`, `--portrait`
(3:4) or `--tall` (9:16).

Delete the `<div class="frame__placeholder">` when you drop real media in —
that's the hatched grey box you see everywhere right now.

### Video loops

Use video instead of GIFs. A 5-second MP4 is roughly a tenth the size of the
equivalent GIF and looks better.

```html
<!-- plays only while on screen -->
<video data-autoloop data-fade poster="assets/media/img/poster.jpg">
  <source src="assets/media/video/clip.webm" type="video/webm">
  <source src="assets/media/video/clip.mp4" type="video/mp4">
</video>
```

- `data-autoloop` — `media.js` sets muted/loop/playsinline and plays it only
  while it's in the viewport. Don't add `autoplay` yourself.
- `data-hover-play` on a parent `.card` — the clip stays frozen until hovered.
- `data-fade` — fades in once decoded, so nothing pops in half-drawn.

To convert something you already have:

```sh
ffmpeg -i in.mov -vf "scale=1280:-2,fps=24" -an -c:v libx264 -crf 26 -movflags +faststart out.mp4
ffmpeg -i in.mov -vf "scale=1280:-2,fps=24" -an -c:v libvpx-vp9 -crf 34 -b:v 0 out.webm
```

---

## Changing the look

Almost everything is in `assets/css/tokens.css`:

| Token | Now | What it controls |
|---|---|---|
| `--paper` | `#f4f1ec` | page background |
| `--ink` | `#16150f` | body + headings |
| `--accent` | `#c0392b` | the interpunct, links, one word per page |
| `--font-serif` | Iowan Old Style stack | everything with a voice |
| `--font-mono` | system mono | dates, labels, nav — the "system" register |
| `--t-mega` | fluid | the hero wordmark size |
| `--section-gap` | fluid | vertical space between sections |

Dark mode is defined at the bottom of the same file and follows the OS setting.

### The wordmark

Written inline so the interpunct can be its own element:

```html
<span class="wordmark">dru<span class="wordmark__dot">·</span>uly</span>
```

Sizes: `.wordmark--sm` (header), default (footer), `.wordmark--mega` (hero).

### Fonts

The serif stack falls back through Iowan Old Style → Palatino → Georgia, so it
looks right on a Mac and acceptable everywhere else. If you want it identical on
every machine, drop a woff2 into `assets/fonts/`, add an `@font-face` at the top
of `tokens.css`, and put the family first in `--font-serif`.

---

## Notes

- Motion is opt-out everywhere: `prefers-reduced-motion` disables every
  transition, the reveal animations, and the video loops.
- Content never depends on JavaScript. With JS off, the `no-js` class keeps
  every `[data-reveal]` element visible.
- Before going live, replace `hello@example.com`, the `#` social links, and add
  a real `assets/media/img/og.jpg` (1200×630).
