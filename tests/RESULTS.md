# Validation results

Unit/service suite: **75 passed, 5 failed (80 total)**. The failures reproduce
asset replacement reverting after export/reload, incorrect dirty-state tracking
after an overlapping save, false-success offline saves when storage is full,
missing selected-wall updates after painting, and incorrect bathroom door visibility.
All assertions remain enabled.

Plan-service coverage: **79.62% lines/statements, 74.89% branches, 78.43%
functions**. Coverage is scoped to the four plan services, not the entire app.
Application and test TypeScript checks pass.

The browser workflows were verified across workflow runs and targeted rechecks:

| Workflow | Outcome |
| --- | --- |
| Inspector position, elevation, rotation and resize → autosave → reload → plan download | Pass |
| Real raycast selection and translation-gizmo drag → disk persistence → reload | Pass |
| Asset replacement → autosave → reload | Fail: replacement reverts |
| Downloaded viewer with service requests blocked | Pass |
| Downloaded editor → offline resize → local storage → reload → plan download | Pass |
| Offline editor → standalone editor HTML export | Fail: missing external template |
| Offline editor → standalone viewer HTML export | Fail: missing external template |
| Export controls at a 1440px viewport | Fail: controls extend beyond viewport |
| Paint change → highlight update without unfocusing | Fail: stale highlight; reselection workaround verified |
| Bathroom isolation → correct entrance only | Fail: hallway door remains visible alongside the real entrance |

The latest targeted browser run reproduced all four assertions for the three
user-reported issues (paint, bathroom, and both HTML export buttons). The companion
service checks pass for retaining the legitimate bathroom entrance and restoring
all openings with Show All.

The browser server builds the production bundle and standalone templates from
current source inside a temporary checkout; generation succeeds. No application
source, working plan, or tracked export template was changed by these tests.

Managed Chromium blocks file navigation. Offline checks fulfill the downloaded
HTML document from its bytes and block every service/asset HTTP request in a
fresh browser context; they do not establish native file or Safari compatibility.

See [KNOWN_BUGS.md](KNOWN_BUGS.md) for reproduction steps and scope of each finding.
