# HView contributor instructions

## Always deliver the latest offline editor

The user wants a ready-to-open offline editor at the end of every HView response. End every final response with a clickable Markdown workspace download link to the latest complete offline editor `.html` file. Make that link the final line, including for documentation-only changes and status responses.

- Link to an actual available HTML file containing the full editor, embedded assets and offline export support. A viewer, template, source page or ZIP does not replace this deliverable.
- Use a direct workspace file link with an absolute path to the HTML artifact, like the download links already provided in this chat. Do not use GitHub links, including repository pages, raw-file URLs, releases or other GitHub download URLs.
- After changes to application code, styles, assets, dependencies or build/export logic, run `npm run build:sample-editor`, verify offline operation, and commit the rebuilt root `hview_editor.html` with the source changes, as required by README.md.
- For documentation-only changes, reuse the current editor HTML; no rebuild is necessary.
- When an uploaded user plan is available, provide a separate editor copy containing that plan and the latest application build. Preserve the uploaded plan itself unchanged, and retain its saved elements, finishes, dimensions, positions and cabinet layouts. Do not replace `public/sample.plan` with the user's upload to generate this copy.
- Use the most recent plan the user actually provided. Do not describe an older uploaded plan as containing subsequent edits that are unavailable to you.
- Check that the linked workspace file exists and reflects the current application source; do not assume an artifact path from an earlier session still exists.

This delivery preference persists across sessions unless the user changes it.
