# HView contributor instructions

## English-only repository content

All new code, identifiers, comments, documentation, asset names, descriptions, aliases, and user-facing text must be in English. Translate Turkish prompts into English requirements; never copy Turkish prompt text into repository content. Preserve existing user plan data unchanged.

Manufacturer paint shade names are an exception: retain their official names in the original language. Do not translate these names or invent translated search aliases.

## Always deliver the latest offline editor

The user wants a ready-to-open offline editor at the end of every HView response. End every final response with a clickable Markdown workspace download link to the latest complete offline editor `.html` file. Make that link the final line, including for documentation-only changes and status responses.

- Link to an actual available HTML file containing the full editor, embedded assets and offline export support. A viewer, template, source page or ZIP does not replace this deliverable.
- Use a direct workspace file link with an absolute path to the HTML artifact, like the download links already provided in this chat. Do not use GitHub links, including repository pages, raw-file URLs, releases or other GitHub download URLs.
- Use this exact Markdown form with the verified absolute file path: `[Download the latest offline editor](/workspace/hview/hview_editor.html)` when the repository is at `/workspace/hview`. If the checkout is elsewhere, substitute its actual absolute path.
- The existing repository HTML can be linked directly; copying it into an output directory, uploading it, or publishing it is not required. If an optional copy fails, link the existing verified workspace HTML instead of withholding the download or asking the user how to link it. Follow any higher-priority runtime restrictions if they explicitly prohibit that path.
- After changes to application code, styles, assets, dependencies or build/export logic, run `npm run build:sample-editor`, verify offline operation, and commit the rebuilt root `hview_editor.html` with the source changes, as required by README.md.
- For documentation-only changes, reuse the current editor HTML; no rebuild is necessary.
- When updating the included plan, replace `public/sample.plan` with the requested plan and rebuild `hview_editor.html`. Preserve all plan data outside the user's requested edits. The editor build reads `public/sample.plan` directly; do not introduce another plan file or fallback selection logic as part of a plan update. Keep geometry regression data under `tests/fixtures/`, separate from the included working plan.
- Use the most recent plan the user actually provided. Do not describe an older uploaded plan as containing subsequent edits that are unavailable to you.
- Check that the linked workspace file exists and reflects the current application source; do not assume an artifact path from an earlier session still exists.

This delivery preference persists across sessions unless the user changes it.
