---
name: Still
description: A quiet, light-first Stremio client for television distance and personal devices.
colors:
  primary: "#354c3c"
  background: "#f6f5f1"
  surface: "#fffefa"
  text: "#252a24"
  muted: "#6b7065"
  line: "#e5e5dc"
  dark-background: "#191b19"
  dark-surface: "#242724"
  dark-text: "#f3f3eb"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "clamp(32px, 3.2vw, 57px)"
    fontWeight: 500
    lineHeight: 1.14
    letterSpacing: "-2px"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.65
rounded:
  control: "10px"
  button: "12px"
  panel: "14px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "18px"
  lg: "28px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.button}"
    padding: "14px 24px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "13px 16px"
---

# Design System: Still

## Overview

**Creative North Star: "The Quiet Living Room"**

Still uses the restraint of a well-made household object: pale neutral fields, deep green controls, generous spacing and information that appears only when it helps. The interface is calm from television distance but remains precise on a tablet or laptop. Liquid-glass navigation is functional depth rather than decoration.

**Key Characteristics:**

- Light-first with an equally deliberate neutral dark theme.
- Quiet surfaces, sparse accent colour and strong content hierarchy.
- Remote, keyboard and touch targets share one interaction vocabulary.
- Detail is progressively disclosed rather than placed in the main path.

## Colors

Deep household green carries selection and primary actions. Warm, nearly white neutrals keep the light theme soft without becoming beige; the dark scheme shifts to neutral charcoal and off-white.

**The Sparse Accent Rule.** Green identifies action, selection and status. It is not general decoration.

## Typography

**Display Font:** Manrope (sans-serif fallback)  
**Body Font:** DM Sans (sans-serif fallback)

Manrope gives headings a clean, gently geometric voice. DM Sans keeps dense settings, captions and metadata highly legible.

### Hierarchy

- **Display:** medium weight with tight tracking, reserved for page and title headings.
- **Title:** medium weight with smaller negative tracking for section headings.
- **Body:** regular weight at the profile-selected scale with a relaxed line height.
- **Label:** compact and direct, with tracked uppercase limited to quiet system status.

**The Television Test.** Primary labels and active state must remain unambiguous at viewing distance and at the smallest supported text scale.

## Layout

Landscape screens use a persistent left navigation rail and one scrolling content field. Content density is grouped into calm sections with more space between tasks than within them. At narrower landscape widths, the rail contracts and controls reflow structurally; typography does not become fluid to compensate. Touch and remote targets are at least 48 pixels high.

## Elevation & Depth

Still is flat by default. Ambient shadows and translucent blur are reserved for navigation, overlays, floating feedback and focused glass controls. Borders or shadows establish a surface, not both at equal strength.

## Shapes

Controls use restrained 10 to 14 pixel corners. Small status badges may be pills. The application icon alone uses the branded squircle silhouette; interface cards do not imitate it.

## Components

### Buttons

- **Primary:** deep green fill, light text and 12 pixel corners.
- **Secondary:** neutral surface with a quiet line.
- **Hover / Focus:** tonal surface change; remote and keyboard focus uses a visible offset outline rather than colour alone.

### Cards / Containers

Content cards let artwork and title information lead. Settings rows are separated by rhythm and fine rules rather than nested cards.

### Inputs / Fields

Inputs use the main surface, a fine neutral outline and 10 pixel corners. Every field has an accessible label. Error copy names both the problem and the recovery.

### Navigation

The rail combines Lucide icons with text. The active destination is raised through the glass surface and remains clear in both themes.

### Switches

Switches use a sliding circular thumb with a complete, aligned track. State is exposed through semantics and position, not colour alone.

## Do's and Don'ts

### Do:

- **Do** keep common playback and browsing paths visually quiet.
- **Do** use Lucide icons at a consistent stroke and optical size.
- **Do** preserve 48 pixel interaction targets and visible focus.
- **Do** use British spelling in all interface copy.

### Don't:

- **Don't** use purple as a product accent or make dark mode the default.
- **Don't** place every piece of information in a separate card.
- **Don't** use emoji, Unicode glyphs or colour alone as interface status.
- **Don't** use em dashes in product copy.
