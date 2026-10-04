---
name: Herdr Roam
description: A personal AI software studio for coordinating local coding Agents, with the density and predictability of a mature IDE.
colors:
  background: "light-dark(oklch(0.982 0.002 250), oklch(0.135 0.004 250))"
  surface: "light-dark(oklch(0.997 0.001 250), oklch(0.185 0.005 250))"
  sidebar: "light-dark(oklch(0.965 0.004 250), oklch(0.115 0.006 250))"
  raised: "light-dark(oklch(0.938 0.005 250), oklch(0.24 0.007 250))"
  hover: "light-dark(oklch(0.925 0.006 250), oklch(0.265 0.008 250))"
  foreground: "light-dark(oklch(0.205 0.008 250), oklch(0.93 0.004 250))"
  muted: "light-dark(oklch(0.42 0.012 250), oklch(0.72 0.008 250))"
  faint: "light-dark(oklch(0.49 0.01 250), oklch(0.65 0.008 250))"
  border: "light-dark(oklch(0.86 0.006 250), oklch(0.32 0.007 250))"
  border-strong: "light-dark(oklch(0.74 0.009 250), oklch(0.42 0.01 250))"
  primary: "light-dark(oklch(0.54 0.145 255), oklch(0.73 0.105 255))"
  primary-soft: "light-dark(oklch(0.91 0.03 255), oklch(0.34 0.055 255))"
  on-accent: "light-dark(oklch(0.98 0.002 250), oklch(0.18 0.008 250))"
  success: "light-dark(oklch(0.55 0.12 150), oklch(0.7 0.13 150))"
  warning: "light-dark(oklch(0.67 0.13 75), oklch(0.77 0.13 75))"
  warning-text: "light-dark(oklch(0.5 0.11 65), oklch(0.77 0.13 75))"
  danger: "light-dark(oklch(0.57 0.17 28), oklch(0.7 0.16 28))"
  terminal-bg: "oklch(0.145 0.012 250)"
  terminal-fg: "oklch(0.91 0.006 250)"
typography:
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: "32px"
  heading:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "28px"
  body-sm:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "20px"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "13px"
    fontWeight: 400
  ui:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "16px"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "16px"
    letterSpacing: "0.08em"
  code:
    fontFamily: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Monaco, 'Cascadia Mono', 'Liberation Mono', Consolas, 'PingFang SC', 'Microsoft YaHei', monospace"
    fontSize: "12px"
    fontWeight: 400
rounded:
  sm: "4px"
  md: "6px"
  full: "999px"
components:
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-ghost-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.foreground}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-secondary-hover:
    backgroundColor: "{colors.hover}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-danger-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-danger-ghost-hover:
    textColor: "{colors.danger}"
  button-compact:
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "28px"
  button-compact-icon:
    rounded: "{rounded.sm}"
    size: "28px"
  button-default-icon:
    rounded: "{rounded.md}"
    size: "32px"
---

# Design System: Herdr Roam

## Overview

**Creative North Star: "The Quiet Workbench"**

Herdr Roam is a working instrument, not a showcase. The interface is cool-grey chrome around the things a developer actually reads: Session output, files, documents, and native Agent Terminals. One blue voice marks the primary action, selection, focus, and active work; everything else recedes into a tight neutral ramp separated by hairline borders. Density is IDE-grade: 12px UI text, 28px and 32px controls, 40px headers, nothing ornamental.

Depth is tonal and flat. Panels sit side by side, distinguished by a few lightness steps (sidebar, background, surface) and 1px borders, never by card shadows. The only floating layer is a popover. Motion is limited to 150ms color transitions and collapses under reduced-motion.

Light and dark are equal citizens, authored together as `light-dark()` pairs in OKLCH. Dark mode is not an inversion: it spreads sidebar, background, and surface further apart so panel edges stay legible against a near-black ground. The system rejects card-heavy dashboards, decorative effects, and novel controls that compete with code and Agent activity.

**Key Characteristics:**
- Cool-grey neutrals on hue 250 with a single blue primary (hue 255).
- Two control heights (28px compact, 32px default); headers align at 40px.
- 12px is the working UI size; 11px is the floor.
- Flat surfaces, 1px borders; only popovers carry a shadow.
- One focus treatment everywhere: 2px primary outline, inset 2px.
- WCAG AA contrast in both themes; state never carried by color alone.

## Colors

A restrained cool-grey ramp with one blue accent and three status hues; every value is an OKLCH light/dark pair and the tokens in the frontmatter are normative.

### Primary
- **Instrument Blue** (`primary`): primary buttons, the active in-panel section underline, selection, caret, focus ring (`--color-ring` aliases it), and the `working` status. It is the only chromatic voice in the chrome.
- **Blue Wash** (`primary-soft`): quiet selected or active backgrounds where a full primary fill would shout (selected list rows, active chips).
- **On Accent** (`on-accent`): label color on filled primary and danger buttons; near-white in light, near-black in dark so the label keeps AA on both fills.

### Status
- **Signal Green** (`success`): `done` states and success confirmations.
- **Amber Signal** (`warning`): dots, borders, and icons for `blocked` or needs-attention states. Not for text.
- **Amber Text** (`warning-text`): any warning-colored text. A darker, warmer amber in light mode so it clears AA on light surfaces.
- **Signal Red** (`danger`): destructive buttons, error banners (as a tinted wash, e.g. 8% fill with a 30% border), and danger-ghost hover text.

### Neutral
- **Sidebar Grey** (`sidebar`): sidebar, tab bar, and Assistant panel tab strip; the darkest ground in dark mode, a slightly tinted ground in light.
- **Workspace Grey** (`background`): the app ground behind panels.
- **Paper** (`surface`): the content surface where artifacts are read (Session output, files, documents, home).
- **Raised** (`raised`): inset fills such as code blocks, chips, and secondary wells.
- **Hover** (`hover`): hover and pressed fills for ghost and secondary controls, and open-menu triggers.
- **Ink** (`foreground`): primary text.
- **Muted Ink** (`muted`): secondary text, ghost button labels, metadata.
- **Faint Ink** (`faint`): tertiary text, section labels, placeholders, `unknown` status. Still AA on its intended grounds; never go lighter.
- **Hairline** (`border`): every panel division, header underline, and secondary button stroke.
- **Strong Hairline** (`border-strong`): hover borders, input strokes, and the scrollbar thumb.
- **Terminal Ground / Terminal Ink** (`terminal-bg`, `terminal-fg`): fixed dark pair for native Agent Terminals in both themes; the Terminal is always dark.

Code highlighting uses its own closed palette (`--syntax-comment`, `-keyword`, `-string`, `-number`, `-title`, `-variable`, `-punct`, `-deletion`), also authored as light/dark OKLCH pairs. Those tokens are for highlighted code only.

### Named Rules
**The One Voice Rule.** Blue is the only accent in the chrome. Status hues appear only when they report real runtime state; they are never decoration.

**The Amber Split Rule.** `warning` paints dots, borders, and icons; `warning-text` paints letters. Never set text in `warning`.

**The Spread-in-the-Dark Rule.** In dark mode, sidebar (L 0.115), background (L 0.135), and surface (L 0.185) are deliberately farther apart than in light. New dark values must keep that separation, not collapse it.

## Typography

**UI Font:** Inter (with ui-sans-serif, system-ui, -apple-system, Segoe UI, PingFang SC, Microsoft YaHei fallbacks)
**Code Font:** the platform monospace stack (`--font-code`: ui-monospace, SF Mono, Menlo, Cascadia Mono, Consolas, with CJK fallbacks)

**Character:** A neutral grotesk tuned for small sizes, paired with the system monospace for code and Terminal content only. CJK fallbacks are part of the stack because Session and document text is often mixed-language.

### Hierarchy
- **Title** (600, 24px, 32px): page-level titles on home and empty surfaces. Rare.
- **Heading** (600, 18px, 28px): section headings inside a surface.
- **Body Small** (400, 14px, 20px): roomier prose blocks and dialog body text.
- **Body** (400, 13px): the document default set on `body`; running text in panels.
- **UI** (400 or 500, 12px, 16px): most UI: buttons, list rows, tabs, menu items, metadata. This is the working size.
- **Label** (600, 11px, 16px, 0.08em tracking, uppercase): section labels that group sidebar lists, menus, and board columns. 11px (`text-2xs`) is the minimum size anywhere.
- **Code** (400, monospace): code blocks, inline code, file paths in code context, and Terminal output.

The reader's body size is user-controlled and sits outside this scale.

### Named Rules
**The Eleven Floor Rule.** No text below 11px. Ever.

**The Scale-Only Rule.** Sizes come from the scale (11, 12, 13, 14, 18, 24) via tokens (`text-2xs`, `text-xs`, body default, `text-sm`, `text-lg`, `text-2xl`). No arbitrary px font sizes in new code.

**The Mono-Means-Code Rule.** Monospace marks literal machine text (code, paths, Terminal). It is never a decorative "technical" flavor for labels or headings.

## Layout

The shell is a panel layout in the IDE mold: a sidebar, a tab bar over the main work surface, and a tabbed Assistant panel hosting Agent Terminals. The work artifact owns the largest area; chrome stays at the edges.

- **Header line:** sidebar header, tab bar, and Assistant panel tab strip are all 40px tall with a 1px bottom border, so their baselines line up across panels.
- **Control heights:** two only. Compact 28px (`--control-sm`) for dense rows, toolbars, and inline actions; default 32px (`--control-md`) for standalone actions and fields. Section label rows in lists share the 28px rhythm.
- **Spacing rhythm:** the 4px Tailwind step. Tight horizontal insets (8px) inside lists and headers; 10px button padding; 6px icon-to-label gap.
- **Reading width:** long-form Session and document content is capped (about 48rem) and centered on the surface.
- **Overflow:** the body never scrolls; panels scroll independently with a thin scrollbar in `border-strong` on a transparent track.

### Named Rules
**The Two Heights Rule.** Every interactive control is 28px or 32px tall. A third height is a bug.

**The Shared Header Line Rule.** Any new panel header sits on the same 40px line as its neighbors.

## Elevation & Depth

Flat by construction. Panels are separated by tonal steps and 1px `border` hairlines, not shadows. The single shadow in the system belongs to floating layers (menus, popovers, dropdowns), which also share one stacking level (`--z-dropdown: 20`).

### Shadow Vocabulary
- **Popover** (`--shadow-popover`: `0 4px 8px oklch(0.15 0.01 250 / 0.12)` light, `0 4px 8px oklch(0.05 0.01 250 / 0.42)` dark): menus, popovers, select listboxes, tooltips. Nothing else.

### Named Rules
**The Only-Floaters-Cast Rule.** If it doesn't float above the layout, it has no shadow. Cards, panels, and buttons are flat.

## Shapes

Small, consistent corners derived from one base radius (`--radius`, 6px). Corners read as precise, not soft.

- **Small (4px, `rounded-sm`):** compact controls and menu items.
- **Medium (6px, `rounded-md`):** default buttons, inputs, popovers, cards, and banners.
- **Large (`rounded-lg`, base + 3px = 9px):** defined but with no current call site; reserve it for larger containers such as dialogs and do not use it until one exists.
- **Full (999px, `rounded-full`):** status dots and badges only.

Borders are 1px everywhere. Focus is drawn as an inset outline so it never collides with neighboring panels or gets clipped by overflow.

### Named Rules
**The Pill Is a Dot Rule.** Fully rounded shapes are reserved for status dots and badges. Buttons, inputs, and chips that act as controls use sm or md.

**The Token Corners Rule.** Radii come from `rounded-sm`, `rounded-md`, `rounded-full` (and `rounded-lg` once a real container needs it). No hard-coded radius values in new code.

## Components

Controls are compact, quiet at rest, and only gain fill on hover, press, or selection.

### Buttons
Built with `class-variance-authority` and Tailwind in `ui-packages/web/src/ui/button`; variant and size names are a stable API. Defaults: `variant="ghost"`, `size="default"`, `type="button"`.

- **Shape:** 6px (`rounded-md`) at default size; 4px (`rounded-sm`) at compact size.
- **Sizes:** `compact` 28px tall, 10px horizontal padding, 12px icons; `default` 32px tall, 10px padding, 14px icons; `compactIcon` 28px square; `defaultIcon` 32px square. Label text is 12px with a 20px line box; icon and label sit 6px apart.
- **Ghost (default):** transparent, `muted` text, weight 400. Hover, press, or open menu (`data-state="open"`) fills with `hover` and lifts text to `foreground`. The workhorse for toolbars and rows.
- **Secondary:** transparent with a 1px `border` stroke, `foreground` text. Hover strengthens the stroke to `border-strong` and fills with `hover`.
- **Primary:** `primary` fill, `on-accent` text, weight 500. Hover darkens to 95% brightness, press to 90%. One per view.
- **Danger:** same treatment on a `danger` fill, for confirmed destructive actions.
- **Danger Ghost:** ghost at rest; hover shows a 10% `danger` wash and `danger` text. For destructive actions in rows and menus where a red button at rest would be loud.
- **Focus:** the global focus rule (2px `primary` outline, -2px offset).
- **Disabled:** 45% opacity, `not-allowed` cursor; no hover response.
- **Motion:** 150ms on color, background, border, and filter.

### Shipped primitives (phase 1)
Built shadcn/ui-style on Radix and Tailwind, owned in `ui-packages/web/src/ui/`. Merge classes with `cn()` (tailwind-merge, aware of the `text-2xs` token). Each was added together with its call sites; a primitive whose last caller goes away is removed with it (Select was dropped when the board's directory filter was removed).

- **SegmentedControl** (`ui/segmented-control`): native radio inputs in a `fieldset` with a visually hidden legend, so arrow keys and screen readers work natively. Track on `raised`, selected segment on `surface` with medium weight. Use for 2–5 mutually exclusive, always-visible options (provider, column count) instead of a select. Also the Preview/Source switch in the Markdown header and the HTML reader's 40px mode bar, and the page-width choice in reading settings.
- **ToggleChip** (`ui/toggle-chip`): a borderless 28px filter toggle with `aria-pressed`, `rounded-sm`, transparent at rest with `hover` fill. Pressed adds `primary-soft` fill, medium weight, and a `primary` check, so selection never relies on color alone. In the Agents board status bar, zero counts render in `faint` and a non-zero Blocked count in semibold `warning-text`.
- **SearchField** (`ui/search-field`): leading search icon, 28/32px, focus shown on the field frame (`primary` border plus 1px ring); optional trailing count in 11px `muted`.
- **StatusDot** (`features/agent/status-dot.tsx`): the only status-to-color map (`blocked` = `warning`, `working` = `primary`, `idle` = `muted`, `done` = `success`, `unknown` = `faint`; no status = `faint`). Always labelled. Lives with the Agent feature because it encodes Agent state, not a generic UI concept. Runtime connection dots (connected / reconnecting / unavailable) are a different signal and do not use it.
- **PopoverContent** (`ui/popover`): the one floating surface. Portals a Radix popover onto `surface` with a 1px `border`, `rounded-md`, `--shadow-popover`, and `--z-dropdown`; `sideOffset` 4, `collisionPadding` 8. Width and padding come from the caller. Context menus share its surface class.
- **MenuItem** (`ui/menu`): a 28px `rounded-sm` row in 12px text, with `hover` fill on hover, keyboard focus, or Radix highlight, and 45% opacity when disabled. Icons are 14px. `selected` adds a right-aligned `primary` check; `tone="muted"` is for secondary actions such as Manage. `menuItemVariants` styles Radix menu items and radio labels the same way.
- **ContextMenu** (`ui/context-menu`): Radix ContextMenu on the popover surface, with `p-1`, items from `menuItemVariants`, and a 1px `border` separator.
- **Tab strip** (`ui/tab-strip`): styles only, shared by tab strips whose keyboard and close behavior differ. A selected tab sits on `surface`, has an inset 2px `foreground` top rule, and connects to the content below. The close button shows on hover and is always visible on the current tab. Used by the workbench tab bar and the Assistant Agent tabs (narrower, 12px). Labels are 12px with 14px icons.
- **Input** (`ui/input`): 28/32px text field on `surface` with a 1px `border`. Focus uses the SearchField treatment (`primary` border plus 1px ring). Add `font-mono` for paths.
- **WorkspaceSelect** (`shell/context-sidebar/project-panel/workspace-select.tsx`): picks the worktree the file tree reads from. Switching is occasional, so in the Files panel it takes no row of its own: a 24px borderless trigger at the trailing edge of the Sessions/Files tab row (shown only on Files with two or more worktrees), with the branch in 11px mono `muted` truncated at 8rem and the full branch and path in its title. In forms (`layout="field"`) it is a 32px bordered field matching Input. The menu grows to its content (up to 28rem) and shows name, branch or Project marker, and the path.
- **SectionHeader** (`ui/section-header`): the 11px uppercase semibold Label in `faint` on a 28px row, grouping a list or menu. An optional count follows the title in regular weight; an optional action sits at the trailing edge in normal case.
- **Banner** (`ui/banner`): a tinted status wash (8% fill, 30% border) with 12px text, at least 32px tall. Full-width rows take a bottom border; `inset` banners inside lists and menus are `rounded-md` boxes. `warning` keeps `muted` text and announces as status; `danger` uses `danger` text and announces as an alert. At most one trailing action.
- **EmptyState** (`ui/empty-state`): centered 12px `muted` line, with an optional 20px `faint` icon and a 14px medium `h2` title above it, and at most one action below (a compact secondary Button such as Try again). Used for empty or failed lists, an empty Assistant, an unavailable Agent, and the no-project workbench.
- **Reader controls** (`components/reader`): the Markdown header uses a compact SegmentedControl and compactIcon Buttons; reading settings sit on PopoverContent. The reading-theme swatches are the one place raw colors are allowed, because each previews its theme's own paper and ink. The code reader keeps 12px top padding and a 2.5em line-number gutter with 1em on each side.
- **Underline tabs** (`shell/context-sidebar/project-panel/resource-tabs`): in-panel section switches such as Sessions / Files. 12px labels on a 32px row; the active one is semibold with a 2px `primary` underline. Document tabs (workbench, Assistant) use the tab strip's `foreground` top rule instead, so the two never read as the same control.
- **List rows** (`ui/list-row`): the two-line sidebar row shared by Sessions, Agents and Skills. 8px padding, a 12px semibold title, an 11px `faint` meta line, `hover` fill, `primary-soft` when active, and a status dot aligned to the title's first line.
- **Tree rows** (`ui/tree-row`, shared by the project file tree and the Skill contents tree): 28px `rounded-sm` rows in 12px `muted`, 13px icons, `hover` fill; the open file uses `primary-soft`. Each tree sets its own indent (14px per level for files, 12px in the narrower Skill contents). In-tree Load more and Retry directory are full-width compact ghost Buttons.
- **DetailHeader** (`ui/detail-header`): the 40px single-line header of File, Skill and Session tabs. A 14px icon (or StatusDot), the 12px semibold `h1` title (truncated at 45%), the path or working directory in 11px mono `faint` filling the rest with its full value in the title, then meta (size, Badges, status) and compact actions at the trailing edge.
- **Badge** (`ui/badge`): `rounded-full` 1px `border` pill, 11px `muted`, for scope, source and provider labels.
- **Size exceptions:** activity-bar buttons are 36px squares; the Agent pane toolbar and the Agent details popover header are 32px sub-toolbars under the 40px Assistant tab line, keeping terminal space.

### Planned primitives (phase 2, added with their regions)
Only introduced when a region migrates and supplies real call sites.

- **Select:** Radix Select for pickers that need one; trigger at 28/32px with fixed chevron padding, items with a `primary` check. The workspace picker is `WorkspaceSelect`, a listbox on PopoverContent.
- **Tooltip:** small popover surface, 12px text, same shadow and stacking.

## Do's and Don'ts

### Do:
- **Do** take every color from a token; author new tokens as `light-dark()` OKLCH pairs and keep the dark-mode surface spread.
- **Do** use `warning-text` for warning-colored text and `warning` only for dots, borders, and icons.
- **Do** build controls at 28px (compact) or 32px (default), and line panel headers up at 40px.
- **Do** use the single global focus treatment (2px `primary` outline, -2px offset) on every interactive element.
- **Do** pair every status color with a label or icon so state never depends on color alone.
- **Do** keep the work artifact primary: content on `surface`, chrome on `sidebar` and `background`, metadata in `muted` and `faint`.

### Don't:
- **Don't** set text below 11px.
- **Don't** hard-code radii or px font sizes in new code; use `rounded-*` and `text-*` tokens.
- **Don't** use a native `<select>` for app controls; use the Select primitive.
- **Don't** use monospace as decoration; it is for code, paths, and Terminal output only.
- **Don't** remove a focus outline without a visible replacement.
- **Don't** add shadows to anything that doesn't float; only popovers use `--shadow-popover`.
- **Don't** use `rounded-full` on buttons, inputs, or chips that act as controls; it is for status dots and badges.
- **Don't** let chrome, summaries, or decoration crowd out code, documents, or Agent activity.
