# Seed — Foundational APIs for an external spec UI

Developer message (2026-07-31), verbatim:

> I want to create a UI for xspec. The idea is that you can edit specs and visualize their dependencies, see the nested structure inline with the MDX and jump between references etc. This won't necessarily be a part of the xspec spec itself but xspec needs to have the foundational apis to connect to this interface. what changes do you recommend to put in a patch in order to work toward this goal?

## Scope

- Developer plans an interactive UI on top of xspec: editing specs, visualizing requirement dependencies, seeing the nested structure inline with the MDX, and jumping between references.
- The UI itself is expected to live outside the xspec product boundary — xspec stays headless. Building the UI is not part of this work.
- The work: xspec gains the foundational, machine-consumable surfaces that such an external interface needs to connect to it — the data behind dependency visualization, nested structure, and reference navigation, and whatever the product must expose for an external editor to work against it safely — as those needs map onto xspec's existing behavior.
- This is an open-ended, recommendation-seeking seed: Developer asks the process to determine and propose the concrete set of changes as a patch, coming back to Developer with questions wherever the right call depends on Developer intent.
