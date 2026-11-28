# Coding standards

Judgement calls for review; anything a script can check lives in `pnpm test` or CI instead.

## Layout

- **A resized container carries its children.** When a diff changes a container's size, padding or border (or drops a
  `border-image`), check what is sized against it: rows that are a fraction of a sheet, fixed-size frames inside them,
  offsets tied to the old border width. A 72px icon frame in a row a fifth of a 560px pane overflows; a sprite's 28px
  transparent border left behind becomes dead padding.
