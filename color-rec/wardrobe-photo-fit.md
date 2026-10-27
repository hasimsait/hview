# Master bedroom wardrobe: photo-constrained model

The working plan includes the fitted wardrobe. This changes the wardrobe and the supplied master-bedroom ceiling height, independently of the earlier colour study.

| Dimension | Model | Basis |
| --- | ---: | --- |
| Ceiling | 272 cm | User measurement |
| Crown above the upper doors | 8.5 cm | User measurement |
| Top of upper door fronts | 263.5 cm | 272 − 8.5 |
| Rightmost double-door module width | 130 cm | User-confirmed existing model width; width retained; run aligned to the complete wall |
| Handle fixing centres | 96 mm | User measurement; assumed centre-to-centre |
| Left three-door module | 139 cm | Perspective ratio constrained to the existing wall span |
| Left single door bay / adjoining double-door bay | 51 / 88 cm | Photo-based subdivision of the left module |
| Centre double-door and drawer module | 98 cm | Perspective ratio constrained to the existing wall span |
| Horizontal division above lower doors | 210 cm above floor | Projective height fit ≈208 cm; rounded to 210 cm |
| Top of three-drawer stack | 75 cm above floor | Projective height fit ≈72 cm; rounded to 75 cm |
| Plinth | 10 cm | Photo estimate |
| Each drawer front band | ≈21.7 cm | (75 − 10) / 3 |
| Depth | 75 cm | Retained from supplied plan; not recoverable from this front view |

The bed remains 160 × 200 cm and the sill remains 85 cm above the floor. There are seven lower hinged doors in total: three on the window side, two over the drawers, and the confirmed two at the right. Matching upper doors, framed ivory fronts, curved brass pulls, paired drawer pulls and a shallow crown reproduce the visible construction. Unseen interior storage has not been inferred.

## Perspective calculation and limits

Coordinates below refer to the 1368 × 1824 chat image. Approximate visible lines:

- Horizontal division: (648, 370) to (1368, 247).
- Floor/front boundary: (637, 950) to (1368, 1350).
- Left vertical: (647, 194) to (635, 947).
- Centre/right vertical: (1234, 0) to (1103, 1215).

Their intersections give horizontal and vertical vanishing points near (−168, 509) and (549, 6355). Assuming a centred principal point, square pixels and perpendicular cabinet axes gives a focal length near 1441 image pixels. The nominal 26 mm equivalent iPhone 15 main camera predicts approximately 1370 pixels for a full, uncropped 4:3 frame. The roughly 5% difference is consistent with uncertain edge picks, lens correction or crop; the phone model is a useful cross-check, not exact calibration without the original image and metadata.

Ray/plane intersection with those axes and a 263.5 cm front height gives approximately 142 cm for the left three doors and 99 cm for the centre bay: a ratio of 1.43:1. Their unconstrained sum would exceed the available room span when combined with the confirmed 130 cm rightmost bay. The model therefore preserves the base plan’s 367 cm full wall run and divides the remaining 237 cm in that ratio, giving rounded bays of 139 and 98 cm. The user confirms that the base wall geometry is correct and that the wardrobe fills the entire wall; this fixes the overall span. The internal widths remain a photo fit, rather than independent tape measurements. The left single-door subdivision is less well constrained.

For collinear vertical image coordinates, the height fraction is `((floor − mark) / (vertical_vp − mark)) / ((floor − top) / (vertical_vp − top))`. This gives approximately 208 cm for the main division and 72 cm for the drawer top, rounded as shown above. Small edge-picking errors affect the result by several centimetres. The rightmost outer edge and the wardrobe depth are not fully visible, and handle mounting holes cannot be located precisely in this resized image. The photograph does not establish millimetre accuracy. A tape measurement of the main split and centre bay would resolve the remaining fitting ambiguity.
