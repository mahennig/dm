# Design Mindset

Static marketing site for Design Mindset.

## Files

- `index.html`: document structure, SEO metadata, and content.
- `styles-experience.css`: responsive visual design and motion.
- `experience.js`: interactive behavior, video playback, and the portfolio dialog.
- `assets/`: production images, fonts, posters, and videos.

## Local Preview

Serve this directory through any static HTTP server rather than opening `index.html` directly. This gives embedded providers such as YouTube a valid HTTP referrer.

```sh
python3 -m http.server 8099
```

Then visit `http://localhost:8099/`.

## Publishing

Deploy the root contents as a static site at `https://designmindsetagency.com/`. Keep `robots.txt` and `sitemap.xml` at the domain root. Update the sitemap `lastmod` only after a material public-page change.

## Asset Policy

Do not deploy `.archive/`; it holds source/archive media rather than runtime site assets. Keep full-length videos compressed, and use posters or short previews on the initial page load.