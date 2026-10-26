# Vector icon preview

On `chromium` and `chrome-internal` hosts, the diff view for Chromium vector
icon files (`*.icon`) gets a **Preview / Source diff** toggle in the diff
header, similar to Gerrit's built-in Rich Markdown diff toggle. When enabled,
the text diff is replaced with the rendered icon for Base and Patchset, side by
side, for every size representation (`CANVAS_DIMENSIONS`) in the file.

Files in this directory:

- `icon-preview.ts`: the toggle button (`diff-header-controls` endpoint),
  the replacement view (`diff-content` endpoint, which sets
  `replace-content` so Gerrit hides `<gr-diff-host>`), the `SHOW_DIFF`
  handler, and the host allowlist. Both versions of the file are rebuilt from
  the diff `<gr-diff-host>` already loaded, so no extra requests are made. If
  the diff skips lines (very large files only), the button isn't shown.
- `vector-icon.ts`: `.icon` → SVG converter following
  `ui/gfx/paint_vector_icon.cc` semantics.
- `icon-preview_test.ts`: tests for both.

## Security

`.icon` contents are controlled by the CL author, so the converter
(1) accepts only known command names and finite numbers, failing closed on
anything else, (2) builds the SVG only from fixed templates and those parsed
numbers, so no file text reaches the output, and (3) the SVG is displayed only
via `<img src="data:image/svg+xml;base64,...">`, which never
runs script or loads external resources.

## Testing

The tests run as part of the plugin's tests. From
`plugins/chromium-behavior/web`:

    make test
