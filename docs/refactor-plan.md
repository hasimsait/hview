# Refactor status

The behavioral-domain cutover is implemented on `refactor`. [architecture.md](architecture.md) is the current design guide; the earlier source audit and proposed migration stages are superseded.

The application now has:

- One immutable `PlanDocument` in `EditorSession`, edited through named commands.
- Behavioral walls, columns, rooms, openings, and furniture families with explicit visitor dispatch.
- Retained scene nodes, resource leases, typed picking, and material strategies shared by editor and viewer.
- Explicit save coordination, snapshot acknowledgement, queued storage adapters, and a versioned codec.
- Behavioral `WallRecess` objects with explicit host IDs. Splits, deletion, cuts, queries, and inherited finishes use that relationship. Legacy host metadata is interpreted only on import.

The mutable manager, parser/exporter services, service locator, duplicate rendering-coupled entity hierarchy, old asset-builder registry, proximity-based recess cut/host search, standalone snapping helper, and public cache-only save API have been removed.

For subsequent changes, finish each cutover through editing, history, rendering, and persistence, then remove its predecessor. Do not introduce another editable document or a permanent synchronization layer.

Validation commands and scope are documented in [../tests/README.md](../tests/README.md); results are in [../tests/RESULTS.md](../tests/RESULTS.md).
