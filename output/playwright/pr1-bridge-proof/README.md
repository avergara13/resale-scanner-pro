## PR1 Bridge Proof

These screenshots verify that the PR1 foundation bridge is visually neutral on untouched UI.

Captured conditions:
- Viewport: `393px` wide
- Themes: light and dark
- States: `main` vs `ui/rsp-ios-polish-foundation`

Captured surfaces:
- Settings top
- Settings diagnostics / Connection History
- Settings diagnostics / Detection History

Naming convention:
- `pr1-main-*` = baseline from `main`
- `pr1-branch-*` = candidate state from `ui/rsp-ios-polish-foundation`

What this proves:
- The semantic-token bridge in `src/index.css` preserves untouched screen rendering while enabling the new Apple-style foundation tokens.
- No visible drift was introduced on the sampled untouched screens in either color mode.
