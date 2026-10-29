# The Dream editor kit

Plain ES modules, no build, theme tokens only; served as `/common/ui/` by every Dream server. `demo.html`
shows them all together. Plan: `docs/ui-plan.md`, "Shared kit".

| Module | What it is |
| --- | --- |
| `theme.css` | The tokens (dark, neutral), per-app accent from `<html data-app>`, and the styles of every module below. |
| `window.js` | Floating windows: drag, resize, snap, minimise, close; place and size remembered per app; `windowMenu()`, `windows()`. |
| `panes.js` | `mountPanes()`: every `.pane` in a page's hidden `#wins` becomes a floating window and the top bar is made, in one call. |
| `menubar.js` | The top bar: app name in the accent, menus of items (`'windows'` lists every window), the portal link, a slot for the app's controls. |
| `tree.js` | A hierarchy: expand, select (click, Ctrl, Shift), rename (F2, double-click), drag to reparent or reorder, eye, search; data through callbacks. |
| `inspector.js` | Rows from a field list in the `dream-common/web/schema` shapes: number (drag-scrub), vector3, colour, slider, toggle, select, text, JSON; `section()`, `row()`, `addMenu()`. |
| `gizmo.js` | Move / rotate / scale handles over three's TransformControls (passed in), with snapping and undo hooks. |
| `toast.js` | One status line; `checkLibrary()` warns once when the Library is down. |
