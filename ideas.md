# TNOC Risk Dashboard — Design Ideas

<response>
<text>
**Design Movement:** Corporate Intelligence / Data Command Centre
**Core Principles:** Authority through restraint, data hierarchy, precision layout, zero decoration
**Color Philosophy:** Deep navy (#1F3864) as the commanding background for the header and sidebar, with a pure white content canvas. Risk zone colours (red/orange/amber/green) serve as the only accent system — every colour carries meaning, nothing is decorative.
**Layout Paradigm:** Fixed top header banner + full-width content area with a 12-column CSS grid. KPI tiles snap to a 6-column row. Charts occupy equal-thirds. The risk register table spans full width with frozen header.
**Signature Elements:** Gold (#C9A84C) accent line under the header; colour-coded score badges in the table; doughnut chart with bold centre number.
**Interaction Philosophy:** File upload is the single entry point — drag-and-drop zone with animated border pulse. After upload, the dashboard fades in section by section.
**Animation:** Staggered fade-up entrance for each row (header → KPIs → charts → table). Chart numbers count up on entry. Score badges scale in.
**Typography System:** "Inter" for body data; "DM Sans" bold for KPI numbers and titles. Clear size hierarchy: 32px KPI numbers, 14px labels, 11px table data.
</text>
<probability>0.08</probability>
</response>

<response>
<text>
**Design Movement:** Operational Dashboard / Utility-First
**Core Principles:** Maximum information density, scannable hierarchy, colour as signal, no chrome
**Color Philosophy:** Light grey (#F4F6F8) page background with white cards. The only strong colour is the navy header. Risk zone colours are used exclusively for data encoding — not for decoration.
**Layout Paradigm:** Asymmetric split — upload panel takes the left 40% on the landing state; dashboard takes full width after upload. Cards use a tight 8px gap grid.
**Signature Elements:** Thin coloured top-border stripe on each KPI card (matching zone colour); horizontal rule separating header from content; monospaced font for risk IDs.
**Interaction Philosophy:** Upload triggers instant parse and render with a progress skeleton loader. All numbers animate from 0 on first render.
**Animation:** Skeleton shimmer during parse; counter animation on KPI numbers; chart slices draw in clockwise.
**Typography System:** "IBM Plex Sans" for all UI; "IBM Plex Mono" for risk IDs and scores. 28px KPI numbers, 10px table cells.
</text>
<probability>0.07</probability>
</response>

<response>
<text>
**Design Movement:** Modern Enterprise SaaS / Clean Authority
**Core Principles:** Structured whitespace, bold typographic hierarchy, purposeful colour, card-based modularity
**Color Philosophy:** White page background. Navy (#1F3864) header with gold accent stripe. Cards have subtle shadow (not border). Risk zone colours only on data elements.
**Layout Paradigm:** Full-width sticky header. Below: a single-column upload state that transforms into a multi-row dashboard grid on file load. Each section is a self-contained card with a section title bar.
**Signature Elements:** Animated doughnut chart with centre label; colour-coded score pills in the table; status counter pills (In Progress / Not Started / Closed) above the doughnut.
**Interaction Philosophy:** Drag-and-drop upload with file type validation. Parse feedback via a slim progress bar. Dashboard sections animate in with a 100ms stagger.
**Animation:** Cards slide up 16px and fade in on load. Chart arcs draw in over 800ms. KPI numbers count up over 600ms.
**Typography System:** "DM Sans" 700 for headings and KPI numbers; "Inter" 400/500 for body and table. Strict size scale: 36px hero KPI, 13px card title, 10px table cell.
</text>
<probability>0.09</probability>
</response>

## Selected Design
**Modern Enterprise SaaS / Clean Authority** — structured whitespace, bold typographic hierarchy, card-based modularity, navy header with gold accent, risk zone colours as the only accent system.
