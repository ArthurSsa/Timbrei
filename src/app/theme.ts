// Brutalist theme tokens
// Cream background + heavy black ink, thick borders and hard offset shadows.
// Curve colors follow the squig.link (CrinGraph) listener palette.

export const C = {
  // Surfaces
  bg: '#fff8eb',        // hsl(40 100% 96%): main cream background
  panel: '#fffdf6',     // near-white panel on cream
  panelAlt: '#f1e7cf',  // darker cream for header strips / section bars
  surface: '#ffffff',   // pure white (chart plot, inputs)

  // Ink / text
  ink: '#141414',       // near-black, primary text + borders
  inkSoft: '#5c5446',   // warm gray secondary text
  inkFaint: '#9c907a',  // faint warm gray (placeholders, ticks)

  // Borders
  border: '#141414',    // heavy brutalist border
  borderSoft: '#d9cdaf',// hairline border on cream

  // Accent (EQ curve / active state)
  accent: '#ff5a00',    // bold flat orange
  accentInk: '#ffffff',

  // Hard offset shadow: the brutalist signature
  shadow: '3px 3px 0 #141414',
  shadowSm: '2px 2px 0 #141414',
} as const;
