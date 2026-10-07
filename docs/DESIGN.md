# Design: brand mirror for Magentic Procurement Exception Bench

Independent concept by Ayo Ahmed. Not affiliated with Magentic.

Checked against the live public site on 2026-10-07 (desktop at 1366 px, mobile at 390 px):
https://www.magentic.com/, https://www.magentic.com/capabilities, https://www.magentic.com/security.
The role came from the public job post: https://jobs.ashbyhq.com/magentic/13f5cf7d-2da6-49d8-85a8-72f6b215b81c

## What the live site does (observed)

| Element | Observed on magentic.com | Used here |
|---|---|---|
| Logo | Official wordmark SVG (`framerusercontent.com/images/uNnPIxpHm6ZdPR1FWZcSkoLjJwQ.svg`, 140x24, black fill), placed top-left in the nav | Same file, unmodified, at `public/brand/magentic-logo.svg`, top-left, 140x24 |
| Display type | Asta Sans, weight 400–500, tight negative tracking (h1 60px / -3px; h2 40px / -1.6px) | Asta Sans (Google Fonts, SIL OFL) for headings, same tracking ratios |
| Body type | Inter / Inter Display (Framer default) | Inter |
| Labels | Geist Mono / IBM Plex Mono uppercase micro-labels inside small tinted chips ("SECURITY", "CASE STUDY", "PENDING REVIEW") | Geist Mono for chips, IDs, money and trace data |
| Page background | Warm off-white `#F9F5F3`; cards on `#F4ECE6` | Same |
| Ink | Black `#000` / near-black `#1F1F1F`; secondary `#6B6868`; hairlines `#B2B2B2` at low opacity | Same |
| Primary action | Solid black rectangle, white text, square corners ("Learn more"); inverse white rectangle on photos ("Schedule demo") | Same: square black buttons, no rounding |
| Accent chips | Pink `#F7C9E8` (section tag), yellow `#FFC902` (news banner, capabilities CTA), pale cyan `#C9F1F7` (consent buttons), green "SUGGESTED"/"SAVING" chips in product shots | Pink = policy/section tag, yellow = needs human review, cyan = info/provenance, green = safe/validated; red-tinted chip = blocked |
| Blue | `rgb(0,153,255)` / `#2593EF` used for links/highlight | Focus rings and links only |
| Product UI shots | White panels on a textured grey ground: tabbed "PURCHASE REQUEST / CHECKS / PURCHASE ORDER" header, checklist rows with circle status icons ("Supplier on framework", "Price matches contract", "Payment terms", "Cost centre", "Quote attached"), mono uppercase tags ("SUPPLIER NOT ON FRAMEWORK", "PENDING REVIEW"), mono tables of PO lines with currency values | The bench mirrors this: a tabbed fixture panel, per-step checklist with circle status icons, mono tags, mono money tables |
| Layout | Wide 20 px gutters, generous whitespace, flat (no shadows, no gradients), hairline dividers, 2-column feature grid that collapses to 1 column on mobile; hamburger nav on mobile | Flat panels, hairlines, 3-column desktop workbench → 2 at 820 px → 1 at 390 px |

## Tone of the copy (observed)
Plain, declarative, customer-money focused: "a wrong answer costs a customer real money" (JD), "Digital workers complete work and pull humans in at key review points, with clear evidence traces for important actions" (security page), "Every interaction with your systems of record is deterministic and controlled" (security page). The bench copy follows that voice and uses their nouns only where public ("digital workers", "PR→PO", "evidence").

## Guardrails
- Small, always-visible label in the header: **"Independent concept by Ayo Ahmed. Not affiliated with Magentic."**
- A visible "SIMULATED" chip on the trace and the ERP-action step: no model, ERP, supplier or quote is real.
- No claim that this is a Magentic product, and nothing implying their systems have this defect. The product hypothesis is labelled HYPOTHESIS.
- Customer logos (SAP, Coupa, Oracle, Workday) and photography from the site are **not** reused. The ERP in the bench is a generic mock called "Mock ERP".

## Font licensing
Asta Sans, Inter and Geist Mono are open-licensed (SIL OFL) and load from Google Fonts. No proprietary font is needed. If Google Fonts is unreachable, the fallback stack is `system-ui` / `ui-monospace`.

See `docs/brand/brand-guide.html` for the visual guide (swatches, type scale, components).
