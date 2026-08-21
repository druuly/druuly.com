# dru·uly

Personal site — portfolio and blog. Plain HTML, CSS and JavaScript. No build
step, no dependencies, no framework.

See [GUIDE.md](GUIDE.md) for running it, adding posts, projects and media, and
changing the look.

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
