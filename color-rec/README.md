# Room colour recommendations

Native HView cutaway renders of all 10 spaces in the uploaded `hview_1792965122887.plan`, using the application at commit `6463d2c`. Colours are selected from the bundled Filli Boya Momento Silan catalogue. This folder contains concept previews; it does not change the working plan or application.

## Files

- [Full comparison study (PDF)](room-colour-study.pdf): all rooms, original views, proposed colours, swatches and explanations.
- [Comparison sheets](comparisons/): five PNG sheets; saved room on the left, proposed painted finishes on the right.
- [Recommended-colour renders](renders/): one 1400 × 1050 PNG per room.
- [Palette data](palette.json): exact catalogue names and RGB references, room IDs, accent wall IDs, application scope and notes.

## Palette

| Room / render | Main colour | Accent | Application |
| --- | --- | --- | --- |
| [Living Room (13.3 m²)](renders/01-living-room-13m2.png) | SİS BULUTU (#ece6db) | ANDEZİT 25 (#b9bfc2) | Painted walls only |
| [Bedroom (8.3 m²)](renders/02-bedroom-8m2.png) | KIRIK BEYAZ (#fbfaf5) | KAKTÜS 20 (#b9cbb6) | Painted walls only |
| [Kitchen (8.0 m²)](renders/03-kitchen.png) | KIRIK BEYAZ (#fbfaf5) | None | Painted walls only |
| [Master Bedroom (11.4 m²)](renders/04-master-bedroom.png) | HASIR 310 (#e2dbd4) | GÜNBATIMI (#864954) | Painted walls only |
| [Guest WC (2.1 m²)](renders/05-guest-wc.png) | KUM BEYAZI (#eeedeb) | None | Ceiling / dry trim only |
| [Hallway / Entry (11.7 m²)](renders/06-hallway-entry.png) | SİS BULUTU (#ece6db) | None | Painted walls only |
| [Dining / Office (5.5 m²)](renders/07-dining-office.png) | HASIR 340 (#e5dfd7) | None | Painted walls only |
| [Living Room (22.0 m²)](renders/08-living-room-22m2.png) | HASIR 340 (#e5dfd7) | None | Painted walls only |
| [Bathroom (1.3 m²)](renders/09-shower.png) | KUM BEYAZI (#eeedeb) | None | Ceiling only; retain tile and glass |
| [Bathroom (4.2 m²)](renders/10-bathroom.png) | KUM BEYAZI (#eeedeb) | None | Painted walls only |

## Render conditions and preserved details

The source upload is preserved unchanged. Room geometry, furniture dimensions and positions, saved visibility, tiles and glass are retained. Foreground walls, their openings and ceilings are omitted to expose each interior; long shared elements are clipped at the isolated room bounds. The lighting is a fixed HView daylight model with PBR Neutral tone mapping and a 6500 K viewing reference. These are model renders, not a measured daylight or spectral paint simulation.

For the tiled WC and shower, no wall repaint is proposed. KUM BEYAZI is shown as a ceiling / dry-trim colour reference; ceilings are not visible in the cutaway views. Confirm a substrate-appropriate, moisture-rated coating for wet-room painted surfaces and retain tile in direct-spray areas.

The laundry stack outside the 4.2 m² bathroom boundary is optional and outside the isolated room crop. A possible alternative placing a dryer in the small bedroom has not been modelled; no appliances have been moved for these renders.

Manufacturer shade names are preserved in their original language. Digital swatches are approximate: approve physical samples under the installed daylight and lamp conditions before ordering paint.

Catalogue reference: [Filli Boya Momento Silan colour selector](https://www.filliboya.com/urun/momento-silan).

Source upload SHA-256: `c18f98017dce560c308785128b02aaa69841c5ba3c09eccb825e9e208ea94af8`.
