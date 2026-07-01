# Don Narek post images

Drop each Don Narek post's picture here as a `.jpg` (or `.jpeg`/`.png`/`.webp`),
then point at it from `../facebook.json` with the post's `image` field
(the file name, e.g. `"image": "2026-07-fete.jpg"`).

Images are bundled at build time (`import.meta.glob`), so they never hotlink,
expire, or hit CORS. A post with no `image` renders an on-brand Armenian motif
instead — so a permalink alone is enough.
