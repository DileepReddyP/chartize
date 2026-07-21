import { createGlobalTheme, globalKeyframes, globalStyle } from "@vanilla-extract/css";

const vars = createGlobalTheme(":root", {
  color: {
    canvas: "#f4f7f6",
    panel: "#ffffff",
    ink: "#0a0f0d",
    muted: "#596662",
    line: "#c4cbca",
    strongLine: "#87938f",
    teal: "#3cbbb1",
    tealDark: "#147d76",
    tealPale: "#ddf5f2",
    amethyst: "#2a1e5c",
    amethystPale: "#ece9f8",
    watermelon: "#ee4266",
  },
  // One semantic stacking scale for the entire workbench. Components choose a
  // role in the hierarchy instead of inventing a local z-index; nested
  // decorations use the two underlay roles inside an isolated surface.
  layer: {
    decorationBack: "-2",
    decoration: "-1",
    content: "0",
    sticky: "1",
    chrome: "2",
    floatingControl: "3",
    popover: "4",
    modal: "5",
    top: "6",
  },
});

const systemFont = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const conversationFont = '"Avenir Next", Avenir, "Segoe UI Variable", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';

globalStyle("*", { boxSizing: "border-box" });
globalStyle("html, body", { width: "100%", height: "100%", margin: 0, overflow: "hidden" });
globalStyle("body", { background: vars.color.canvas, color: vars.color.ink, fontFamily: systemFont, fontSize: "14px" });
globalStyle("button, input, select, textarea", { font: "inherit" });
globalStyle("button, a, summary", { WebkitTapHighlightColor: "transparent" });
globalStyle("a", { color: "inherit" });
globalStyle("button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible", { outline: `3px solid ${vars.color.teal}`, outlineOffset: "2px" });
globalStyle("button:disabled", { cursor: "not-allowed", opacity: 0.48 });

globalStyle(".topbar", {
  position: "relative",
  height: "40px",
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr) auto",
  alignItems: "center",
  gap: "10px",
  padding: "0 14px",
  background: vars.color.panel,
  borderBottom: `1px solid ${vars.color.line}`,
});
globalStyle(".brand", { display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", fontSize: "17px", fontWeight: 650, letterSpacing: "-.04em", textTransform: "lowercase" });
// The AI glass intentionally reaches across the header, but the product mark
// remains a dependable escape route from the conversation.
globalStyle(".topbar > .brand", { position: "relative", zIndex: vars.layer.top });
globalStyle(".brand-mark", { width: "15px", height: "15px", background: vars.color.teal, borderRadius: "50%" });
globalStyle(".topbar-workspace-lockup", { minWidth: 0, justifySelf: "start", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" });
globalStyle(".workspace-switcher", { position: "relative", minWidth: 0 });
globalStyle(".workspace-switcher > summary", { maxWidth: "min(34vw, 390px)", minHeight: "27px", display: "grid", gridTemplateColumns: "25px minmax(0, 1fr) 18px", alignItems: "center", overflow: "hidden", border: `1px solid ${vars.color.line}`, borderRadius: "2px", background: vars.color.canvas, color: vars.color.ink, cursor: "pointer", listStyle: "none" });
globalStyle(".workspace-switcher > summary::-webkit-details-marker", { display: "none" });
globalStyle(".workspace-switcher > summary > span", { height: "100%", display: "grid", placeItems: "center", background: vars.color.ink, color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "7px" });
globalStyle(".workspace-switcher > summary > b", { minWidth: 0, overflow: "hidden", padding: "0 8px", color: vars.color.ink, fontSize: "8px", fontWeight: 590, textAlign: "center", textOverflow: "ellipsis", textTransform: "lowercase", whiteSpace: "nowrap" });
globalStyle(".workspace-switcher > summary svg", { width: "12px", height: "12px", fill: "none", stroke: "currentColor", strokeWidth: 1.5 });
globalStyle(".workspace-switcher[open] > summary", { borderColor: vars.color.tealDark, background: vars.color.tealPale, color: vars.color.tealDark });
globalStyle(".workspace-switcher[open] > summary svg", { transform: "rotate(180deg)" });
globalStyle(".workspace-switcher > div", { position: "absolute", top: "calc(100% + 7px)", left: 0, zIndex: vars.layer.top, width: "min(390px, calc(100vw - 28px))", overflow: "hidden", border: `1px solid ${vars.color.strongLine}`, borderTop: `4px solid ${vars.color.teal}`, borderRadius: "2px", background: "rgb(255 255 255 / 97%)", boxShadow: "0 18px 50px rgb(10 15 13 / 19%)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" });
globalStyle(".workspace-switcher > div > header", { minHeight: "44px", display: "grid", gridTemplateColumns: "36px minmax(0, 1fr) auto", alignItems: "stretch", borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".workspace-switcher > div > header > i", { display: "grid", placeItems: "center", background: vars.color.ink, color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "7px", fontStyle: "normal" });
globalStyle(".workspace-switcher > div > header > span", { minWidth: 0, display: "grid", alignContent: "center", gap: "1px", padding: "6px 9px" });
globalStyle(".workspace-switcher > div > header b", { fontSize: "12px", fontWeight: 360, textTransform: "lowercase" });
globalStyle(".workspace-switcher > div > header small", { color: vars.color.muted, fontSize: "7px" });
globalStyle(".workspace-switcher > div > header button", { margin: "8px", padding: "4px 8px", border: 0, borderLeft: `2px solid ${vars.color.teal}`, background: vars.color.tealPale, color: vars.color.tealDark, cursor: "pointer", fontSize: "8px", fontWeight: 560, textTransform: "lowercase" });
globalStyle(".workspace-switcher ol", { maxHeight: "min(420px, 60vh)", overflow: "auto", margin: 0, padding: 0, listStyle: "none" });
globalStyle(".workspace-switcher li", { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 32px", borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".workspace-switcher li:last-child", { borderBottom: 0 });
globalStyle(".workspace-switcher li.active", { background: vars.color.tealPale, boxShadow: `inset 4px 0 ${vars.color.tealDark}` });
globalStyle(".workspace-switcher li > button:first-child", { minWidth: 0, display: "grid", gridTemplateColumns: "31px minmax(0, 1fr)", alignItems: "stretch", padding: 0, border: 0, background: "transparent", color: vars.color.ink, cursor: "pointer", textAlign: "left" });
globalStyle(".workspace-switcher li > button:first-child > i", { display: "grid", placeItems: "center", color: vars.color.muted, fontFamily: "ui-monospace, monospace", fontSize: "7px", fontStyle: "normal" });
globalStyle(".workspace-switcher li > button:first-child > span", { minWidth: 0, display: "grid", gap: "2px", padding: "8px 7px" });
globalStyle(".workspace-switcher li > button:first-child b", { overflow: "hidden", fontSize: "9px", fontWeight: 560, textOverflow: "ellipsis", textTransform: "lowercase", whiteSpace: "nowrap" });
globalStyle(".workspace-switcher li > button:first-child small", { color: vars.color.muted, fontSize: "7px", textTransform: "lowercase" });
globalStyle(".workspace-switcher li > button:last-child", { border: 0, background: "transparent", color: vars.color.muted, cursor: "pointer", fontSize: "17px", fontWeight: 300 });
globalStyle(".workspace-switcher li > button:last-child:hover:not(:disabled)", { background: "rgb(238 66 102 / 8%)", color: vars.color.watermelon });
globalStyle(".topbar nav", { justifySelf: "end", display: "flex", alignItems: "center", gap: "18px" });
globalStyle(".topbar nav a", { color: vars.color.muted, textDecoration: "none", fontSize: "11px", fontWeight: 600, textTransform: "lowercase" });
globalStyle(".topbar nav a:hover", { color: vars.color.tealDark });
globalStyle(".toolbar-ai-button", { position: "relative", zIndex: vars.layer.content, minHeight: "27px", display: "flex", alignItems: "center", gap: "5px", padding: "4px 9px", overflow: "hidden", border: 0, borderRadius: "4px", background: "transparent", color: vars.color.amethyst, cursor: "pointer", isolation: "isolate", fontSize: "10px", fontWeight: 590, textTransform: "lowercase", "@media": { "screen and (max-width: 680px)": { padding: "4px 6px", fontSize: "9px" } } });
globalStyle(".toolbar-ai-button span", { color: vars.color.tealDark });
globalStyle(".toolbar-ai-button.activating::before", { animation: "ai-border-orbit .42s cubic-bezier(.2,.75,.2,1) 1 both" });
globalStyle(".toolbar-ai-button.active", { background: vars.color.tealDark, color: vars.color.panel, boxShadow: `inset 0 0 0 1px ${vars.color.tealDark}` });
globalStyle(".toolbar-ai-button.active span", { color: vars.color.panel });
globalStyle(".toolbar-ai-button.active::before", { animation: "none", background: "none", opacity: 0 });
globalStyle(".toolbar-ai-button.active::after, .toolbar-ai-button.active:hover::after", { background: vars.color.tealDark });

globalStyle(".workbench", { position: "relative", width: "100vw", height: "calc(100dvh - 40px)", overflow: "hidden" });
globalStyle(".workbench-grid", { width: "100%", height: "100%", minWidth: 0, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(390px, 34vw) minmax(0, 1fr)", overflow: "hidden", "@media": { "screen and (max-width: 960px)": { gridTemplateColumns: "360px minmax(0, 1fr)" }, "screen and (max-width: 680px)": { gridTemplateColumns: "minmax(0, 1fr)" } } });

globalStyle(".code-pane", { width: "100%", height: "100%", minHeight: 0, display: "grid", gridTemplateRows: "43px minmax(0, 1fr)", overflow: "hidden", background: vars.color.panel });
globalStyle(".code-toolbar", { position: "relative", display: "flex", alignItems: "center", gap: "8px", padding: "6px 8px 6px 12px", background: vars.color.panel, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".code-toolbar > div", { minWidth: 0, marginRight: "auto" });
globalStyle(".code-toolbar strong", { display: "block", fontSize: "11px", fontWeight: 750, textTransform: "lowercase" });
globalStyle(".code-toolbar > div > span", { display: "block", overflow: "hidden", color: vars.color.muted, textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "8px" });
globalKeyframes("ai-border-orbit", {
  from: { transform: "translate(-50%, -50%) rotate(0turn)" },
  to: { transform: "translate(-50%, -50%) rotate(1turn)" },
});
globalStyle(".toolbar-ai-button::before", { content: "", position: "absolute", left: "50%", top: "50%", zIndex: vars.layer.decorationBack, width: "220%", aspectRatio: "1", background: `conic-gradient(from 0turn, transparent 0 62%, rgb(60 187 177 / 22%) 70%, ${vars.color.teal} 82%, ${vars.color.tealDark} 90%, transparent 100%)`, animation: "ai-border-orbit 2.2s linear infinite", pointerEvents: "none" });
globalStyle(".toolbar-ai-button::after", { content: "", position: "absolute", inset: "1px", zIndex: vars.layer.decoration, borderRadius: "inherit", background: vars.color.panel, pointerEvents: "none" });
globalStyle(".toolbar-ai-button:hover::after", { background: vars.color.tealPale });

globalStyle(".home-page", { width: "100vw", height: "100dvh", overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", background: vars.color.panel, scrollbarColor: `${vars.color.strongLine} transparent`, scrollbarWidth: "thin" });
globalStyle(".home-canvas", { minHeight: "100%", backgroundColor: vars.color.panel, backgroundImage: `linear-gradient(${vars.color.line} 1px, transparent 1px), linear-gradient(90deg, ${vars.color.line} 1px, transparent 1px)`, backgroundSize: "24px 24px, 24px 24px" });
globalStyle(".home-proposition", { minHeight: "62px", display: "grid", gridTemplateColumns: "minmax(150px, .55fr) minmax(320px, 1.7fr) minmax(120px, .55fr)", alignItems: "center", gap: "16px", padding: "9px clamp(14px, 2vw, 28px)", borderBottom: `1px solid ${vars.color.strongLine}`, background: `linear-gradient(90deg, ${vars.color.panel} 0%, ${vars.color.panel} 14%, ${vars.color.tealPale} 58%, rgb(60 187 177 / 30%) 100%)`, "@media": { "screen and (max-width: 760px)": { gridTemplateColumns: "minmax(0, 1fr) auto", gap: "5px 12px" } } });
globalStyle(".home-proposition-brand", { display: "inline-flex", alignItems: "center", gap: "8px", color: vars.color.ink, textDecoration: "none", textTransform: "lowercase" });
globalStyle(".home-proposition-brand .brand-mark", { width: "13px", height: "13px" });
globalStyle(".home-proposition-brand b", { fontSize: "18px", fontWeight: 650, letterSpacing: "-.045em" });
globalStyle(".home-proposition h1", { margin: 0, fontSize: "clamp(15px, 1.7vw, 24px)", fontWeight: 390, lineHeight: 1.05, letterSpacing: "-.035em", textAlign: "center", textTransform: "lowercase", "@media": { "screen and (max-width: 760px)": { gridColumn: "1 / -1", gridRow: 1, textAlign: "left" } } });
globalStyle(".home-proposition-action", { minHeight: "31px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", padding: "6px 9px", border: 0, borderLeft: `3px solid ${vars.color.teal}`, borderRadius: 0, background: vars.color.ink, color: vars.color.panel, cursor: "pointer", fontSize: "8px", fontWeight: 560, textDecoration: "none", textTransform: "lowercase" });
globalStyle(".home-proposition-action:hover", { background: vars.color.tealDark });
globalStyle(".home-editorial-section", { borderBottom: `1px solid ${vars.color.strongLine}` });
globalStyle(".home-editorial-heading", { minHeight: "29px", display: "flex", alignItems: "center", padding: "6px clamp(14px, 2vw, 28px)", borderBottom: `1px solid ${vars.color.line}`, background: "rgb(255 255 255 / 74%)", backdropFilter: "blur(5px)" });
globalStyle(".home-editorial-heading h2", { margin: 0, color: vars.color.tealDark, fontFamily: "ui-monospace, monospace", fontSize: "8px", fontWeight: 620, lineHeight: 1.4, letterSpacing: ".025em", textTransform: "lowercase" });
globalStyle(".home-story-grid", { display: "grid", gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: "8px", padding: "8px clamp(8px, 1.2vw, 16px) 16px", "@media": { "screen and (max-width: 900px)": { gridTemplateColumns: "minmax(0, 1fr)" } } });
globalStyle(".home-story", { minWidth: 0, height: "var(--story-height)", minHeight: 0, gridColumn: "span var(--story-columns)", display: "grid", gridTemplateRows: "auto minmax(0, 1fr) auto", overflow: "hidden", border: `1px solid ${vars.color.strongLine}`, borderTop: `4px solid ${vars.color.teal}`, borderRadius: 0, background: vars.color.panel, "@media": { "screen and (max-width: 900px)": { gridColumn: "1 / -1", height: "auto", minHeight: 0 } } });
globalStyle(".home-story:nth-child(3n + 2)", { borderTopColor: vars.color.amethyst });
globalStyle(".home-story:nth-child(4n)", { borderTopColor: vars.color.watermelon });
globalStyle(".home-story > header", { minHeight: "48px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "end", gap: "8px", padding: "7px 9px", borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".home-story > header > div", { minWidth: 0 });
globalStyle(".home-story > header span", { display: "block", marginBottom: "3px", color: vars.color.tealDark, fontSize: "7px", fontWeight: 600, textTransform: "lowercase" });
globalStyle(".home-story > header h2", { margin: 0, overflow: "hidden", paddingBottom: "2px", fontSize: "clamp(18px, 1.75vw, 27px)", fontWeight: 310, lineHeight: 1.08, letterSpacing: "-.045em", textOverflow: "ellipsis", textTransform: "lowercase", whiteSpace: "nowrap" });
globalStyle(".home-story > header small", { maxWidth: "150px", overflow: "hidden", color: vars.color.muted, fontFamily: "ui-monospace, monospace", fontSize: "6px", textAlign: "right", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".home-story > header", { "@media": { "screen and (max-width: 600px)": { minHeight: "70px", gridTemplateColumns: "minmax(0, 1fr)", alignItems: "start", gap: "4px", padding: "8px 9px" } } });
globalStyle(".home-story > header h2", { "@media": { "screen and (max-width: 600px)": { display: "-webkit-box", overflow: "hidden", textOverflow: "clip", whiteSpace: "normal", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 } } });
globalStyle(".home-story > header small", { "@media": { "screen and (max-width: 600px)": { maxWidth: "none", textAlign: "left" } } });
globalStyle(".home-story-chart", { position: "relative", minWidth: 0, minHeight: 0, overflow: "hidden", padding: "7px", background: vars.color.panel, "@media": { "screen and (max-width: 900px)": { aspectRatio: "var(--story-preview-aspect)" } } });
globalStyle(".home-story-preview", { display: "block", width: "100%", height: "100%", minWidth: 0, minHeight: 0, objectFit: "contain", background: vars.color.panel });
globalStyle(".home-story[data-story-id='us-land-use-square'] .home-story-chart", { display: "grid", placeItems: "center" });
globalStyle(".home-story[data-story-id='us-land-use-square'] .home-story-preview", { width: "auto", height: "100%", maxWidth: "100%", aspectRatio: "64 / 28" });
globalStyle(".home-story > footer", { minHeight: "49px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "center", gap: "8px", padding: "6px 7px 6px 9px", borderTop: `1px solid ${vars.color.line}` });
globalStyle(".home-story > footer p", { maxWidth: "54ch", margin: 0, color: vars.color.muted, fontSize: "7px", lineHeight: 1.4 });
globalStyle(".home-story > footer > div", { display: "flex", alignItems: "center", gap: "4px" });
globalStyle(".home-story > footer a", { minHeight: "27px", display: "inline-flex", alignItems: "center", gap: "3px", padding: "4px 7px", border: 0, borderLeft: `2px solid ${vars.color.ink}`, borderRadius: 0, background: vars.color.canvas, color: vars.color.ink, cursor: "pointer", fontSize: "7px", fontWeight: 580, textDecoration: "none", textTransform: "lowercase" });
globalStyle(".home-story > footer a:hover", { background: vars.color.ink, color: vars.color.panel });
globalStyle(".home-story > footer a.ask", { borderLeftColor: vars.color.teal, background: vars.color.tealPale, color: vars.color.tealDark });
globalStyle(".home-story > footer a.ask:hover", { background: vars.color.tealDark, color: vars.color.panel });
globalStyle(".home-footer", { minHeight: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "24px", padding: "12px clamp(14px, 3vw, 40px)", borderTop: `1px solid ${vars.color.strongLine}`, background: vars.color.ink, color: vars.color.panel });
globalStyle(".home-footer > span", { fontSize: "20px", fontWeight: 320, letterSpacing: "-.05em", textTransform: "lowercase" });
globalStyle(".home-footer > a", { color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "9px", fontWeight: 560, textDecoration: "none", textTransform: "lowercase" });
globalStyle(".home-footer > a:hover", { color: vars.color.teal });
globalStyle(".run-button", { minWidth: "80px", minHeight: "31px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", border: 0, borderRadius: "2px", background: vars.color.teal, color: vars.color.ink, cursor: "pointer", fontSize: "10px", fontWeight: 560, textTransform: "lowercase" });
globalStyle(".run-button:hover", { background: vars.color.tealDark, color: vars.color.panel });
globalStyle(".run-button > span", { fontSize: "8px" });
globalStyle(".code-error", { flex: "0 0 auto" });
globalStyle(".code-error summary", { width: "27px", height: "27px", display: "grid", placeItems: "center", border: 0, borderRadius: "50%", background: "transparent", color: vars.color.watermelon, cursor: "pointer", listStyle: "none", fontSize: "19px", fontWeight: 800 });
globalStyle(".code-error summary::-webkit-details-marker", { display: "none" });
globalStyle(".code-error summary:hover, .code-error[open] summary", { boxShadow: `inset 0 0 0 1px ${vars.color.watermelon}`, background: "rgb(238 66 102 / 8%)" });
globalStyle(".code-error > div", { position: "absolute", top: "calc(100% + 1px)", right: "12px", left: "12px", zIndex: vars.layer.popover, width: "auto", minWidth: 0, padding: "11px 12px", borderLeft: `4px solid ${vars.color.watermelon}`, background: "rgb(255 245 247 / 98%)", color: vars.color.ink, boxShadow: "0 12px 32px rgb(10 15 13 / 16%)" });
globalStyle(".code-error > div strong", { color: vars.color.watermelon, fontSize: "9px", letterSpacing: ".04em", textTransform: "lowercase" });
globalStyle(".code-error > div p", { margin: "5px 0 0", fontSize: "9px", lineHeight: 1.45 });

globalStyle(".pane-empty", { height: "100%", display: "grid", placeContent: "center", gap: "5px", padding: "24px", color: vars.color.muted, textAlign: "center", fontSize: "11px" });
globalStyle(".pane-empty strong", { color: vars.color.ink, fontSize: "16px", fontWeight: 350, textTransform: "lowercase" });
globalStyle(".pane-empty span", { display: "block" });

globalStyle(".preview-stage", { position: "relative", minWidth: 0, minHeight: 0, overflow: "hidden", padding: "10px", background: vars.color.canvas });
globalStyle(".chart-card", { position: "relative", width: "100%", height: "100%", minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(0, 1fr) auto", overflow: "hidden", background: vars.color.panel, border: `1px solid ${vars.color.line}`, borderRadius: "2px" });
globalStyle(".chart-header", { minHeight: "82px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "start", gap: "13px", overflow: "visible", padding: "13px 17px 16px", borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".chart-header-tools", { display: "flex", alignItems: "center", justifyContent: "flex-end", paddingTop: "3px" });
globalStyle(".preview-actions", { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "3px" });
globalStyle(".icon-button", { width: "29px", height: "29px", display: "grid", placeItems: "center", padding: 0, border: 0, borderRadius: 0, background: "transparent", color: vars.color.muted, cursor: "pointer", listStyle: "none", transition: "transform 120ms ease, filter 120ms ease" });
globalStyle(".icon-button:hover, .icon-button.active", { transform: "translateY(-1px) scale(1.08)", filter: "saturate(1.2) brightness(.86)" });
globalStyle(".icon-button.save-action", { background: "transparent", color: vars.color.tealDark });
globalStyle(".icon-button.download-action", { background: "transparent", color: vars.color.amethyst });
globalStyle(".icon-button.tools-action", { background: "transparent", color: vars.color.watermelon });
globalStyle(".icon-button svg", { width: "16px", height: "16px", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" });
globalStyle(".preview-menu", { position: "relative" });
globalStyle(".preview-menu summary::-webkit-details-marker", { display: "none" });
globalStyle(".preview-menu > div", { position: "absolute", top: "calc(100% + 5px)", right: 0, zIndex: vars.layer.popover, width: "195px", display: "grid", padding: "5px", background: vars.color.panel, border: `1px solid ${vars.color.strongLine}`, borderRadius: "2px", boxShadow: "0 10px 30px rgb(10 15 13 / 14%)" });
globalStyle(".preview-menu > div > span", { padding: "5px 9px 3px", color: vars.color.muted, fontSize: "8px", fontWeight: 750, letterSpacing: ".04em", textTransform: "lowercase" });
globalStyle(".preview-menu > div button", { padding: "8px 9px", border: 0, borderRadius: "2px", background: "transparent", color: vars.color.ink, textAlign: "left", cursor: "pointer", fontSize: "10px", fontWeight: 580, textTransform: "lowercase" });
globalStyle(".preview-menu > div button:hover", { background: vars.color.tealPale });
globalStyle(".chart-title", { minWidth: 0, overflow: "visible", padding: "2px 3px 3px" });
globalStyle(".chart-title h1", { margin: 0, fontSize: "clamp(25px, 3vw, 46px)", fontWeight: 300, lineHeight: 1.04, letterSpacing: "-.06em", overflowWrap: "anywhere", textTransform: "lowercase" });
globalStyle(".chart-title p", { maxWidth: "760px", margin: "6px 0 0", color: vars.color.muted, fontSize: "10px", lineHeight: 1.4 });
globalStyle(".chart-label-text", { width: "100%", maxWidth: "100%", display: "block", overflow: "visible", padding: "2px 4px 3px", border: 0, borderRadius: 0, background: "transparent", color: "inherit", font: "inherit", fontWeight: "inherit", lineHeight: "inherit", letterSpacing: "inherit", textAlign: "left", textTransform: "inherit", whiteSpace: "normal", cursor: "text" });
globalStyle(".chart-label-input", { width: "min(100%, 980px)", padding: "1px 4px", border: 0, borderBottom: `2px solid ${vars.color.teal}`, borderRadius: 0, outline: 0, background: vars.color.tealPale, color: "inherit", font: "inherit", fontWeight: "inherit", lineHeight: "inherit", letterSpacing: "inherit", textTransform: "inherit" });
globalStyle(".chart-title p.empty", { opacity: .4 });
globalStyle(".chart-status", { flex: "0 0 auto", marginRight: "5px", padding: "4px 7px", borderRadius: "2px", background: vars.color.canvas, color: vars.color.muted, fontFamily: "ui-monospace, monospace", fontSize: "8px" });
globalStyle(".chart-status.running", { background: vars.color.tealPale, color: vars.color.tealDark });
globalStyle(".chart-view-shell", { position: "relative", minWidth: 0, minHeight: 0, overflow: "hidden" });
globalStyle(".chart-view", { width: "100%", height: "100%", minWidth: 0, minHeight: 0, display: "block", overflow: "auto", padding: "10px", overscrollBehavior: "contain" });
globalStyle(".chart-view > div, .chart-view .vega-embed", { width: "100%", height: "100%", maxWidth: "100%" });
globalStyle(".pane-loading-mask", { position: "absolute", inset: 0, zIndex: vars.layer.chrome, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "rgb(244 247 246 / 48%)", color: vars.color.tealDark, backdropFilter: "blur(11px) saturate(.9)", WebkitBackdropFilter: "blur(11px) saturate(.9)", fontSize: "9px", fontWeight: 700, letterSpacing: ".02em", textTransform: "lowercase" });
globalStyle(".pane-loading-mask .spinner", { width: "20px", height: "20px", background: "rgb(255 255 255 / 48%)", boxShadow: "0 4px 16px rgb(10 15 13 / 9%)" });
globalStyle(".empty-chart", { width: "100%", height: "100%", display: "grid", placeItems: "center", padding: "24px", color: vars.color.muted, textAlign: "center" });
globalStyle(".empty-chart b", { display: "block", marginBottom: "5px", color: vars.color.ink, fontSize: "22px", fontWeight: 300, textTransform: "lowercase" });
globalStyle(".chart-footer", { display: "flex", justifyContent: "space-between", gap: "10px", minWidth: 0, padding: "4px 8px", background: vars.color.canvas, borderTop: `1px solid ${vars.color.line}`, color: vars.color.muted, fontSize: "7px" });
globalStyle(".chart-footer span", { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".status-dot", { display: "inline-block", width: "6px", height: "6px", marginRight: "3px", borderRadius: "50%", background: vars.color.strongLine });
globalStyle(".status-dot.ready", { background: vars.color.tealDark });
globalStyle(".status-dot.error", { background: vars.color.watermelon });
globalStyle(".status-toast", { position: "absolute", left: "12px", bottom: "36px", zIndex: vars.layer.floatingControl, maxWidth: "420px", padding: "8px 10px", border: 0, borderRadius: "2px", background: vars.color.tealPale, color: vars.color.tealDark, cursor: "pointer", textAlign: "left", fontSize: "9px" });

globalStyle(".primary-button, .ghost-button", { minHeight: "31px", padding: "6px 10px", border: `1px solid ${vars.color.line}`, borderRadius: "2px", background: vars.color.panel, color: vars.color.ink, cursor: "pointer", fontSize: "10px", fontWeight: 590, textTransform: "lowercase" });
globalStyle(".primary-button", { borderColor: vars.color.tealDark, background: vars.color.teal, color: vars.color.ink });
globalStyle(".primary-button:hover", { background: vars.color.tealDark, color: vars.color.panel });

globalKeyframes("ai-blur-in", {
  from: { opacity: 0, backdropFilter: "blur(0) saturate(1)", WebkitBackdropFilter: "blur(0) saturate(1)" },
  to: { opacity: 1, backdropFilter: "blur(22px) saturate(1.14)", WebkitBackdropFilter: "blur(22px) saturate(1.14)" },
});
globalKeyframes("ai-surface-in", {
  from: { opacity: 0, transform: "translateY(10px) scale(.992)" },
  to: { opacity: 1, transform: "translateY(0) scale(1)" },
});
globalStyle(".ai-overlay", { position: "fixed", top: 0, bottom: 0, zIndex: vars.layer.modal, minWidth: 0, minHeight: 0, overflow: "visible", isolation: "isolate" });
globalStyle(".ai-overlay.context-code", { right: 0, left: "max(390px, 34vw)" });
globalStyle(".ai-overlay.context-chart, .ai-overlay.context-general", { left: 0, width: "max(390px, 34vw)" });
globalStyle(".ai-overlay::before", { content: "", position: "absolute", inset: "-18px", zIndex: vars.layer.decoration, background: "linear-gradient(90deg, rgb(244 247 246 / 78%) 0%, rgb(244 247 246 / 70%) 84%, rgb(244 247 246 / 28%) 100%)", backdropFilter: "blur(28px) saturate(1.16)", WebkitBackdropFilter: "blur(28px) saturate(1.16)", animation: "ai-blur-in 360ms cubic-bezier(.2,.75,.2,1) both", pointerEvents: "none" });
globalStyle(".ai-overlay.context-code::before", { inset: "-18px -18px -18px 0", background: "rgb(244 247 246 / 70%)", boxShadow: "-14px 0 30px rgb(244 247 246 / 42%)", maskImage: "none", WebkitMaskImage: "none" });
globalStyle(".ai-overlay.context-chart::before, .ai-overlay.context-general::before", { inset: "-18px 0 -18px -18px", background: "rgb(244 247 246 / 70%)", boxShadow: "14px 0 30px rgb(244 247 246 / 42%)", maskImage: "none", WebkitMaskImage: "none" });
globalStyle(".ai-surface", { position: "relative", width: "100%", height: "100%", minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(100px, 1fr) auto", overflow: "hidden", padding: "40px 14px 12px", background: "transparent", border: 0, animation: "ai-surface-in 300ms cubic-bezier(.2,.75,.2,1) both" });
globalStyle(".context-code .ai-surface", { width: "min(590px, 100%)", marginRight: "auto", marginLeft: 0, paddingRight: "24px", paddingLeft: "28px" });
globalStyle(".ai-surface-header", { minHeight: "48px", display: "flex", alignItems: "stretch", justifyContent: "space-between", gap: "10px", borderTop: `1px solid ${vars.color.strongLine}`, borderBottom: `1px solid ${vars.color.strongLine}` });
globalStyle(".ai-title-lockup", { minWidth: 0, display: "grid", gridTemplateColumns: "34px minmax(0, 1fr)", alignItems: "stretch" });
globalStyle(".ai-title-lockup > div", { minWidth: 0, display: "flex", alignItems: "baseline", gap: "7px", padding: "8px 9px 7px" });
globalStyle(".ai-surface-header h2", { margin: 0, fontSize: "27px", fontWeight: 300, lineHeight: 1, letterSpacing: "-.055em", textTransform: "lowercase" });
globalStyle(".ai-surface-header small", { color: vars.color.muted, fontSize: "7px", fontWeight: 650, textTransform: "lowercase" });
globalStyle(".ai-spark", { display: "grid", placeItems: "center", alignSelf: "stretch", background: vars.color.ink, color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "7px", fontWeight: 700, textTransform: "uppercase" });
globalStyle(".popup-close-button", { width: "38px", height: "38px", display: "grid", placeItems: "center", alignSelf: "center", justifySelf: "center", flex: "0 0 auto", padding: 0, border: "1px solid rgb(255 255 255 / 66%)", borderRadius: "50%", background: "rgb(196 203 202 / 38%)", color: vars.color.muted, cursor: "pointer", boxShadow: "inset 3px 3px 8px rgb(89 102 98 / 18%), inset -3px -3px 8px rgb(255 255 255 / 72%)" });
globalStyle(".popup-close-button svg", { width: "16px", height: "16px", display: "block", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" });
globalStyle(".popup-close-button.compact", { width: "27px", height: "27px", boxShadow: "inset 2px 2px 6px rgb(89 102 98 / 16%), inset -2px -2px 6px rgb(255 255 255 / 70%)" });
globalStyle(".popup-close-button.compact svg", { width: "13px", height: "13px" });
globalStyle(".popup-close-button:hover", { transform: "scale(1.06)", color: vars.color.ink, background: "rgb(196 203 202 / 52%)" });
globalStyle(".ai-conversation", { minHeight: 0, overflow: "auto", overscrollBehavior: "contain", padding: "7px 0 10px", fontFamily: conversationFont });
globalStyle(".conversation-preview-label", { margin: "1px 3px 11px", color: vars.color.muted, fontSize: "8px", fontWeight: 700, letterSpacing: ".04em", textTransform: "lowercase" });
globalStyle(".ai-conversation article", { width: "100%", maxWidth: "100%", display: "grid", gridTemplateColumns: "28px minmax(0, 1fr)", gridTemplateRows: "auto auto auto", columnGap: "10px", rowGap: "4px", margin: "0 0 8px", padding: "11px 13px 10px 10px", border: 0, borderLeft: `3px solid ${vars.color.line}`, borderRadius: 0, background: "rgb(255 255 255 / 56%)", boxShadow: "none", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", fontSize: "11px", lineHeight: 1.48 });
globalStyle(".ai-conversation article.user", { borderLeftColor: vars.color.amethyst, background: "linear-gradient(90deg, rgb(236 233 248 / 78%), rgb(255 255 255 / 46%))" });
globalStyle(".ai-conversation article.assistant", { borderLeftColor: vars.color.teal, background: "linear-gradient(90deg, rgb(221 245 242 / 78%), rgb(255 255 255 / 48%))" });
globalStyle(".ai-role-icon", { gridColumn: 1, gridRow: "1 / span 3", width: "28px", height: "28px", display: "grid", placeItems: "center", alignSelf: "start", color: vars.color.panel });
globalStyle(".ai-role-icon.user", { background: vars.color.amethyst });
globalStyle(".ai-role-icon.assistant", { background: vars.color.tealDark });
globalStyle(".ai-role-icon svg", { width: "15px", height: "15px", fill: "none", stroke: "currentColor", strokeWidth: 1.55, strokeLinecap: "round", strokeLinejoin: "round" });
globalStyle(".ai-role-icon.assistant svg", { width: "16px", height: "16px", fill: "currentColor", stroke: "none" });
globalStyle(".ai-conversation article > b", { gridColumn: 2, display: "block", margin: 0, color: vars.color.muted, fontSize: "8px", fontWeight: 650, letterSpacing: ".015em", textTransform: "lowercase" });
globalStyle(".ai-message-body", { gridColumn: 2, maxWidth: "64ch", minWidth: 0, display: "grid", gap: "9px" });
globalStyle(".ai-message-body p", { margin: 0, whiteSpace: "pre-line", fontSize: "11.25px", fontWeight: 400, lineHeight: 1.58, letterSpacing: "-.004em" });
globalStyle(".ai-message-body h1, .ai-message-body h2, .ai-message-body h3", { margin: "3px 0 0", color: vars.color.ink, fontSize: "12px", fontWeight: 620, lineHeight: 1.3, letterSpacing: "-.018em", textTransform: "none" });
globalStyle(".ai-message-body ul, .ai-message-body ol", { display: "grid", gap: "4px", margin: 0, paddingLeft: "18px", fontSize: "11.25px", fontWeight: 400, lineHeight: 1.5 });
globalStyle(".ai-message-body li", { paddingLeft: "2px" });
globalStyle(".ai-message-body li::marker", { color: vars.color.tealDark, fontWeight: 650 });
globalStyle(".ai-message-body blockquote", { margin: 0, padding: "6px 9px", borderLeft: `2px solid ${vars.color.teal}`, background: "rgb(60 187 177 / 8%)", color: vars.color.muted });
globalStyle(".ai-message-body blockquote p", { fontSize: "10.5px" });
globalStyle(".ai-message-body pre", { maxWidth: "100%", overflow: "auto", margin: 0, padding: "8px 9px", borderLeft: `2px solid ${vars.color.amethyst}`, background: "rgb(42 30 92 / 7%)" });
globalStyle(".ai-message-body pre code", { padding: 0, background: "transparent", color: vars.color.ink, whiteSpace: "pre", fontSize: "9.5px" });
globalStyle(".ai-message-body table", { width: "100%", borderCollapse: "collapse", fontSize: "9.5px" });
globalStyle(".ai-message-body th, .ai-message-body td", { padding: "5px 6px", borderBottom: `1px solid ${vars.color.line}`, textAlign: "left", verticalAlign: "top" });
globalStyle(".ai-message-body th", { color: vars.color.tealDark, fontWeight: 620 });
globalStyle(".ai-message-body strong", { display: "inline", margin: 0, padding: 0, color: vars.color.ink, fontSize: "inherit", fontWeight: 620, letterSpacing: 0, textTransform: "none" });
globalStyle(".ai-message-body code", { padding: "1px 3px", background: "rgb(60 187 177 / 13%)", color: vars.color.tealDark, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: ".9em" });
globalStyle(".ai-message-body a", { color: vars.color.tealDark, fontWeight: 590, textDecorationColor: vars.color.teal, textUnderlineOffset: "2px" });
globalStyle(".ai-message-actions", { gridColumn: 2, justifySelf: "start", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "5px 11px", marginTop: "3px" });
globalStyle(".ai-message-redo", { display: "flex", alignItems: "center", gap: "4px", padding: "3px 4px 2px 0", border: 0, borderBottom: `1px solid transparent`, background: "transparent", color: vars.color.muted, cursor: "pointer", fontSize: "7.5px", fontWeight: 560, textTransform: "lowercase" });
globalStyle(".ai-message-redo:hover", { borderBottomColor: vars.color.teal, color: vars.color.tealDark });
globalStyle(".ai-message-redo svg", { width: "12px", height: "12px", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" });
globalStyle(".ai-inline-approval", { display: "flex", alignItems: "center", gap: "5px", color: vars.color.ink, cursor: "pointer", fontSize: "7.5px", fontWeight: 580, lineHeight: 1.2, textTransform: "lowercase" });
globalStyle(".ai-inline-approval input", { width: "12px", height: "12px", margin: 0, accentColor: vars.color.tealDark });
globalStyle(".ai-inline-approval:has(input:checked)", { color: vars.color.tealDark });
globalKeyframes("ai-thinking-pulse", { "0%, 80%, 100%": { transform: "translateY(0)", opacity: .32 }, "40%": { transform: "translateY(-3px)", opacity: 1 } });
globalKeyframes("ai-context-arrive", { from: { transform: "translateY(7px)", opacity: 0 }, to: { transform: "translateY(0)", opacity: 1 } });
globalStyle(".ai-thinking", { display: "grid", gridTemplateColumns: "28px auto minmax(0, 1fr) max-content", alignItems: "center", gap: "9px", margin: "0 0 8px", padding: "9px 13px 9px 10px", borderLeft: `3px solid ${vars.color.teal}`, background: "linear-gradient(90deg, rgb(221 245 242 / 68%), rgb(255 255 255 / 35%))", color: vars.color.tealDark, fontSize: "8px", fontWeight: 520 });
globalStyle(".ai-thinking .ai-role-icon", { gridColumn: "auto", gridRow: "auto", alignSelf: "center" });
globalStyle(".ai-thinking-dots", { display: "flex", alignItems: "center", gap: "3px" });
globalStyle(".ai-thinking-dots i", { width: "4px", height: "4px", borderRadius: "50%", background: vars.color.tealDark, animation: "ai-thinking-pulse 1.15s ease-in-out infinite" });
globalStyle(".ai-thinking-dots i:nth-child(2)", { animationDelay: "120ms" });
globalStyle(".ai-thinking-dots i:nth-child(3)", { animationDelay: "240ms" });
globalStyle(".ai-thinking > b", { fontWeight: 520, textTransform: "lowercase" });
globalStyle(".ai-thinking-elapsed", { minWidth: "72px", justifySelf: "end", color: vars.color.muted, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: "8px", fontVariantNumeric: "tabular-nums", letterSpacing: "-.02em", textAlign: "right" });
globalStyle(".ai-conversation-end", { height: "1px" });
globalStyle(".ai-compose-area", { display: "grid", gap: 0, paddingTop: "9px" });
globalStyle(".ai-composer", { overflow: "visible", border: `1px solid ${vars.color.strongLine}`, borderRadius: "2px", background: "rgb(231 237 235 / 48%)", boxShadow: "inset 5px 5px 16px rgb(42 30 92 / 10%), inset -5px -5px 15px rgb(255 255 255 / 82%), 0 10px 32px rgb(10 15 13 / 7%)", backdropFilter: "blur(20px) saturate(1.18)", WebkitBackdropFilter: "blur(20px) saturate(1.18)", viewTransitionName: "chartize-ai-entry" });
globalStyle(".ai-composer:focus-within", { borderColor: vars.color.tealDark, boxShadow: "inset 4px 4px 15px rgb(42 30 92 / 12%), inset -5px -5px 15px rgb(255 255 255 / 88%), 0 0 0 1px rgb(60 187 177 / 28%), 0 12px 34px rgb(10 15 13 / 8%)" });
globalStyle(".ai-composer-heading", { minHeight: "29px", display: "grid", gridTemplateColumns: "31px minmax(0, 1fr) auto", alignItems: "stretch", borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".ai-composer-heading > span", { display: "grid", placeItems: "center", background: vars.color.ink, color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "7px" });
globalStyle(".ai-composer-heading > b", { alignSelf: "center", paddingLeft: "8px", fontSize: "8px", fontWeight: 590, textTransform: "lowercase" });
globalStyle(".ai-composer-mode", { display: "flex", alignItems: "stretch" });
globalStyle(".ai-composer-mode button", { minWidth: "46px", padding: "0 7px", border: 0, borderLeft: `1px solid ${vars.color.line}`, background: "transparent", color: vars.color.muted, cursor: "pointer", fontSize: "7.5px", fontWeight: 560, textTransform: "lowercase" });
globalStyle(".ai-composer-mode button.active", { background: vars.color.tealPale, color: vars.color.tealDark });
globalStyle(".ai-composer-mode button:disabled", { opacity: .35, cursor: "default" });
globalStyle(".ai-composer textarea", { width: "100%", minHeight: "58px", resize: "none", padding: "9px 10px", border: 0, outline: 0, background: "transparent", color: vars.color.ink, fontSize: "11px", lineHeight: 1.45 });
globalStyle(".ai-composer textarea:focus-visible", { outline: 0 });
globalStyle(".ai-composer-preview", { width: "100%", minHeight: "58px", display: "block", padding: "9px 10px", border: 0, background: "transparent", color: vars.color.ink, textAlign: "left" });
globalStyle(".ai-composer-preview .ai-message-body", { maxWidth: "100%", display: "grid" });
globalStyle(".ai-composer-footer", { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "6px 9px", padding: "0 8px 8px" });
globalStyle(".ai-composer-tools", { minWidth: 0, display: "flex", flex: "1 1 250px", flexWrap: "wrap", alignItems: "center", gap: "5px" });
globalStyle(".ai-attach-data", { minHeight: "27px", display: "inline-flex", alignItems: "center", gap: "5px", padding: "4px 7px", border: 0, borderBottom: `1px solid ${vars.color.tealDark}`, color: vars.color.tealDark, cursor: "pointer", fontSize: "8px", fontWeight: 560, textTransform: "lowercase" });
globalStyle(".ai-attach-data:hover", { background: vars.color.tealPale });
globalStyle(".ai-attach-data svg", { width: "14px", height: "14px", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" });
globalStyle(".ai-attach-data input", { display: "none" });
globalStyle(".ai-file-drop-overlay", { position: "absolute", inset: "40px 14px 12px", zIndex: vars.layer.top, display: "grid", placeContent: "center", justifyItems: "center", gap: "7px", padding: "24px", border: `2px dashed ${vars.color.tealDark}`, background: "rgb(221 245 242 / 88%)", color: vars.color.tealDark, textAlign: "center", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", pointerEvents: "none" });
globalStyle(".ai-file-drop-overlay svg", { width: "28px", height: "28px", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round" });
globalStyle(".ai-file-drop-overlay b", { fontSize: "16px", fontWeight: 360, textTransform: "lowercase" });
globalStyle(".ai-file-drop-overlay small", { maxWidth: "270px", color: vars.color.muted, fontSize: "8px", lineHeight: 1.45 });
globalStyle(".ai-send-cluster", { display: "flex", flex: "0 0 auto", alignItems: "center", gap: "6px", marginLeft: "auto" });
globalStyle(".ai-send-cluster > span", { color: vars.color.muted, fontSize: "8px" });
globalStyle(".ai-send-button", { minHeight: "29px", display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", border: 0, borderRadius: "1px", background: vars.color.amethyst, color: vars.color.panel, cursor: "pointer", fontSize: "9px", fontWeight: 560, textTransform: "lowercase", boxShadow: "none" });
globalStyle(".ai-send-button svg", { width: "13px", height: "13px", fill: "none", stroke: vars.color.teal, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" });
globalStyle(".ai-actions", { display: "flex", flexWrap: "wrap", gap: "5px" });
globalStyle(".ai-actions > button", { minHeight: "25px", padding: "4px 7px", border: 0, borderBottom: `1px solid ${vars.color.amethyst}`, borderRadius: 0, background: "transparent", color: vars.color.amethyst, cursor: "pointer", fontSize: "7.5px", fontWeight: 560, textTransform: "lowercase" });
globalStyle(".ai-settings", { position: "relative" });
globalStyle(".ai-settings > summary", { width: "28px", height: "28px", display: "grid", placeItems: "center", padding: 0, border: 0, borderRadius: 0, background: vars.color.ink, color: vars.color.panel, cursor: "pointer", listStyle: "none" });
globalStyle(".ai-settings > summary::-webkit-details-marker", { display: "none" });
globalStyle(".ai-settings > summary:hover, .ai-settings[open] > summary", { background: vars.color.tealDark, color: vars.color.panel });
globalStyle(".ai-settings > summary svg", { width: "17px", height: "17px", fill: "none", stroke: "currentColor", strokeWidth: 1.65, strokeLinecap: "round", strokeLinejoin: "round" });
globalStyle(".ai-settings > div", { position: "absolute", zIndex: vars.layer.popover, bottom: "calc(100% + 8px)", left: 0, width: "min(340px, 72vw)", overflow: "hidden", border: `1px solid ${vars.color.strongLine}`, borderTop: `4px solid ${vars.color.teal}`, borderRadius: "2px", background: "rgb(244 247 246 / 94%)", boxShadow: "0 16px 44px rgb(10 15 13 / 17%)", backdropFilter: "blur(24px) saturate(1.16)", WebkitBackdropFilter: "blur(24px) saturate(1.16)" });
globalStyle(".ai-send-cluster .ai-settings > div", { left: "auto", right: 0 });
globalStyle(".ai-settings > div > header", { minHeight: "36px", display: "grid", gridTemplateColumns: "34px minmax(0, 1fr)", alignItems: "stretch", padding: 0, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".ai-settings > div > header > i", { display: "grid", placeItems: "center", background: vars.color.ink, color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "7px", fontStyle: "normal" });
globalStyle(".ai-settings > div > header > span", { minWidth: 0, display: "flex", alignItems: "baseline", gap: "7px", padding: "8px 9px" });
globalStyle(".ai-settings > div > header b", { color: vars.color.ink, fontSize: "10px", fontWeight: 560, textTransform: "lowercase" });
globalStyle(".ai-settings > div > header small", { color: vars.color.muted, fontSize: "7px", textTransform: "lowercase" });
globalStyle(".ai-settings > div > label", { display: "grid", gridTemplateColumns: "15px minmax(0, 1fr)", gap: "8px", alignItems: "start", padding: "8px 11px", borderBottom: `1px solid ${vars.color.line}`, cursor: "pointer" });
globalStyle(".ai-settings > div > label:last-child", { borderBottom: 0 });
globalStyle(".ai-settings > div > label.ai-data-setting", { background: "rgb(60 187 177 / 8%)" });
globalStyle(".ai-settings > div > label.ai-local-change-setting", { background: "rgb(238 66 102 / 6%)" });
globalStyle(".ai-settings input", { margin: "2px 0 0", accentColor: vars.color.tealDark });
globalStyle(".ai-settings label span", { minWidth: 0, display: "grid", gap: "2px" });
globalStyle(".ai-settings label b", { color: vars.color.ink, fontSize: "9px", fontWeight: 560, textTransform: "lowercase" });
globalStyle(".ai-settings-cluster", { display: "flex", alignItems: "center", overflow: "visible", paddingLeft: "3px", background: "rgb(196 203 202 / 48%)", boxShadow: "inset 1px 1px 3px rgb(10 15 13 / 8%)" });
globalStyle(".ai-active-options", { display: "flex", alignItems: "center", gap: "1px" });
globalStyle(".ai-active-options > span", { width: "22px", height: "22px", display: "grid", placeItems: "center", color: vars.color.tealDark });
globalStyle(".ai-active-options > span:nth-child(3n)", { color: vars.color.amethyst });
globalStyle(".ai-active-options > .ai-local-change-option", { color: vars.color.watermelon });
globalStyle(".ai-active-options svg", { width: "13px", height: "13px", fill: "none", stroke: "currentColor", strokeWidth: 1.55, strokeLinecap: "round", strokeLinejoin: "round" });
globalStyle(".ai-settings label small", { color: vars.color.muted, fontSize: "7.5px", lineHeight: 1.35 });
globalStyle(".ai-research-ready", { display: "flex", alignItems: "center", gap: "5px", color: vars.color.tealDark, fontSize: "7px", fontWeight: 580, textTransform: "lowercase" });
globalStyle(".ai-research-ready i", { width: "6px", height: "6px", borderRadius: "50%", background: vars.color.teal, boxShadow: `0 0 0 3px rgb(60 187 177 / 12%)` });
globalStyle(".ai-catalog-loading", { color: vars.color.muted, fontSize: "7px", fontWeight: 560, textTransform: "lowercase" });
globalStyle(".checkbox-row", { display: "flex", alignItems: "center", gap: "6px", color: vars.color.muted, fontSize: "9px", fontWeight: 650, textTransform: "lowercase" });
globalStyle(".checkbox-row input", { margin: 0, accentColor: vars.color.tealDark });
globalStyle(".ai-status", { margin: 0, padding: "8px 10px", border: "1px solid rgb(255 255 255 / 62%)", borderRadius: "3px", background: "rgb(236 233 248 / 62%)", color: vars.color.amethyst, fontSize: "9px", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" });

globalKeyframes("spin", { to: { transform: "rotate(360deg)" } });
globalStyle(".spinner", { width: "18px", height: "18px", border: `2px solid ${vars.color.line}`, borderTopColor: vars.color.tealDark, borderRadius: "50%", animation: "spin .7s linear infinite" });
globalStyle(".loading-page", { height: "calc(100dvh - 40px)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", overflow: "hidden", color: vars.color.muted });

globalStyle(".prose-page, .error-page, .admin-shell", { height: "100dvh", overflow: "auto", overscrollBehavior: "contain" });
globalStyle(".prose-page, .error-page", { maxWidth: "1100px", margin: "0 auto", padding: "58px 28px" });
globalStyle(".eyebrow", { margin: "0 0 12px", color: vars.color.tealDark, fontSize: "10px", fontWeight: 750, letterSpacing: ".05em", textTransform: "lowercase" });
globalStyle(".prose-page h1, .error-page h1", { maxWidth: "900px", margin: 0, fontSize: "clamp(38px, 6vw, 76px)", fontWeight: 300, lineHeight: ".95", letterSpacing: "-.065em", textTransform: "lowercase" });
globalStyle(".lede", { maxWidth: "720px", margin: "25px 0", color: vars.color.muted, fontSize: "18px", fontWeight: 350, lineHeight: 1.5 });
globalStyle(".principle-grid", { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", marginTop: "40px", border: `1px solid ${vars.color.line}`, borderRadius: "9px", overflow: "hidden" });
globalStyle(".principle-grid article", { padding: "22px", background: vars.color.panel, borderRight: `1px solid ${vars.color.line}` });
globalStyle(".principle-grid article:last-child", { borderRight: 0 });
globalStyle(".principle-grid b", { fontSize: "16px", fontWeight: 650 });
globalStyle(".principle-grid p", { color: vars.color.muted, fontSize: "12px", lineHeight: 1.5 });
globalStyle(".inline-button", { display: "inline-grid", placeItems: "center", marginTop: "24px", textDecoration: "none" });

globalStyle(".admin-shell", { maxWidth: "1180px", margin: "0 auto", padding: "38px 24px 70px" });
globalStyle(".admin-heading", { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "26px", marginBottom: "22px" });
globalStyle(".admin-heading h1", { margin: "7px 0 12px", fontSize: "clamp(34px, 5vw, 64px)", fontWeight: 300, lineHeight: ".95", letterSpacing: "-.06em", textTransform: "lowercase" });
globalStyle(".admin-heading p", { maxWidth: "620px", color: vars.color.muted, lineHeight: 1.5 });
globalStyle(".privacy-badge", { padding: "7px 10px", background: vars.color.tealPale, borderRadius: "999px", color: vars.color.tealDark, whiteSpace: "nowrap", fontSize: "10px", fontWeight: 700 });
globalStyle(".admin-card", { marginTop: "14px", padding: "20px", background: vars.color.panel, border: `1px solid ${vars.color.line}`, borderRadius: "9px" });
globalStyle(".admin-card h2", { margin: "0 0 16px", fontWeight: 400, textTransform: "lowercase" });
globalStyle(".admin-form", { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "11px" });
globalStyle(".admin-form .wide", { gridColumn: "1 / -1" });
globalStyle(".admin-form label", { display: "grid", gap: "5px", color: vars.color.muted, fontSize: "9px", fontWeight: 700, textTransform: "lowercase" });
globalStyle(".admin-form input, .admin-form textarea", { width: "100%", padding: "9px 10px", border: `1px solid ${vars.color.line}`, borderRadius: "6px", background: vars.color.canvas, color: vars.color.ink });
globalStyle(".admin-form textarea", { resize: "vertical" });
globalStyle(".admin-form .primary-button", { justifySelf: "start" });
globalStyle(".admin-message", { margin: "15px 0 0", padding: "10px", borderRadius: "6px", background: vars.color.tealPale, color: vars.color.tealDark });
globalStyle(".section-heading", { display: "flex", justifyContent: "space-between", alignItems: "end", gap: "16px" });
globalStyle(".section-heading h2", { margin: "3px 0 0" });
globalStyle(".dataset-table", { borderTop: `1px solid ${vars.color.line}` });
globalStyle(".dataset-row", { display: "grid", gridTemplateColumns: "minmax(240px, 1fr) 110px 80px 70px 80px", gap: "12px", alignItems: "center", padding: "14px 0", borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".dataset-row p", { margin: "4px 0 0", color: vars.color.muted, fontSize: "10px" });
globalStyle(".dataset-row > span", { color: vars.color.muted, fontSize: "10px", fontVariantNumeric: "tabular-nums" });
globalStyle(".dataset-row button, .section-heading button", { padding: "6px 8px", border: `1px solid ${vars.color.line}`, borderRadius: "5px", background: vars.color.panel, cursor: "pointer", fontSize: "10px", fontWeight: 560, textTransform: "lowercase" });
globalStyle(".empty-state", { color: vars.color.muted, padding: "18px 0 5px" });

/* The workbench is a document with contextual transients, not a dashboard of permanent modes. */
globalStyle(".editor-workspace", { position: "relative", minWidth: 0, minHeight: 0, overflow: "hidden", background: vars.color.panel, borderRight: `1px solid ${vars.color.strongLine}` });
globalStyle(".editor-workspace .code-pane", { gridTemplateRows: "40px minmax(0, 1fr)" });
globalStyle(".editor-body", { position: "relative", minWidth: 0, minHeight: 0, overflow: "hidden" });
globalStyle(".editor-workspace .code-toolbar", { padding: "5px 9px 5px 14px" });
globalStyle(".editor-workspace .code-toolbar strong", { fontSize: "19px", fontWeight: 300, lineHeight: .95, letterSpacing: "-.045em", textTransform: "lowercase" });
globalStyle(".editor-workspace .code-toolbar > div > span", { marginTop: "3px", fontSize: "8px" });
globalStyle(".new-visualization-button, .example-picker > summary", { minHeight: "27px", display: "flex", alignItems: "center", justifyContent: "center", gap: "3px", padding: "4px 9px", border: `1px solid ${vars.color.line}`, borderRadius: "2px", background: vars.color.panel, color: vars.color.ink, cursor: "pointer", listStyle: "none", fontSize: "8px", fontWeight: 590, textAlign: "center", textTransform: "lowercase", whiteSpace: "nowrap" });
globalStyle(".example-picker > summary svg", { width: "11px", height: "11px", fill: "none", stroke: "currentColor", strokeWidth: 1 });
globalStyle(".new-visualization-button", { borderColor: vars.color.teal, color: vars.color.tealDark });
globalStyle(".example-picker > summary", { borderColor: vars.color.strongLine, color: vars.color.amethyst });
globalStyle(".new-visualization-button > span", { fontSize: "12px", lineHeight: 0 });
globalStyle(".new-visualization-button:hover, .example-picker > summary:hover, .example-picker[open] > summary", { background: vars.color.tealPale, color: vars.color.tealDark });
globalStyle(".example-picker", { position: "relative" });
globalStyle(".example-picker > summary::-webkit-details-marker", { display: "none" });
globalStyle(".example-picker > div", { position: "absolute", top: "calc(100% + 7px)", left: 0, zIndex: vars.layer.top, width: "min(600px, calc(100vw - 26px))", maxHeight: "min(650px, calc(100vh - 94px))", display: "block", overflow: "auto", border: `1px solid ${vars.color.strongLine}`, borderTop: `4px solid ${vars.color.teal}`, background: vars.color.panel, boxShadow: "0 18px 48px rgb(10 15 13 / 19%)", "@media": { "screen and (max-width: 760px)": { position: "fixed", top: "48px", right: "13px", left: "13px", width: "auto" } } });
globalStyle(".example-picker > div > header", { minHeight: "40px", gridColumn: "1 / -1", display: "grid", gridTemplateColumns: "35px minmax(0, 1fr)", alignItems: "stretch", padding: 0, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".example-picker > div > header::before", { content: "\"EX\"", display: "grid", placeItems: "center", background: vars.color.ink, color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "7px" });
globalStyle(".example-picker > div > header strong", { alignSelf: "center", padding: "0 9px", fontSize: "17px", fontWeight: 300, letterSpacing: "-.04em", textTransform: "lowercase" });
globalStyle(".example-category", { display: "block", borderBottom: `1px solid ${vars.color.strongLine}` });
globalStyle(".example-category:last-child", { borderBottom: 0 });
globalStyle(".example-category > header", { minHeight: "35px", display: "grid", gridTemplateColumns: "35px minmax(0, 1fr)", alignItems: "stretch", padding: 0, background: vars.color.canvas, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".example-category > header > span", { display: "grid", placeItems: "center", background: vars.color.tealDark, color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "7px", fontWeight: 650 });
globalStyle(".example-category > header > div", { minWidth: 0, display: "flex", alignItems: "baseline", gap: "8px", padding: "7px 10px" });
globalStyle(".example-category > header strong", { flex: "0 0 auto", fontSize: "13px", fontWeight: 380, lineHeight: 1.05, letterSpacing: "-.025em", textTransform: "lowercase" });
globalStyle(".example-category > header small", { minWidth: 0, overflow: "hidden", color: vars.color.muted, fontSize: "7px", lineHeight: 1.35, textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".example-category > div", { minWidth: 0, display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))" });
globalStyle(".example-category button", { minWidth: 0, display: "grid", gap: "4px", padding: "10px", border: 0, borderRight: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}`, borderRadius: 0, background: vars.color.panel, color: vars.color.ink, cursor: "pointer", textAlign: "left" });
globalStyle(".example-category button:nth-child(even)", { borderRight: 0 });
globalStyle(".example-category button:hover", { background: vars.color.tealPale });
globalStyle(".example-category button strong", { overflow: "hidden", fontSize: "10px", fontWeight: 560, lineHeight: 1.15, letterSpacing: "-.01em", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".example-category button span", { color: vars.color.muted, fontSize: "7px", lineHeight: 1.4 });
globalStyle(".example-category button small", { color: vars.color.tealDark, fontSize: "6px", fontWeight: 560, textTransform: "lowercase" });

globalStyle(".dwim-panel", { position: "fixed", left: "var(--dwim-left)", top: "var(--dwim-top)", zIndex: vars.layer.popover, width: "min(640px, calc(100vw - var(--dwim-left) - 12px))", maxHeight: "min(620px, calc(100vh - 60px))", display: "grid", gridTemplateRows: "auto auto auto minmax(0, 1fr)", overflow: "hidden", border: `1px solid ${vars.color.strongLine}`, borderTop: `4px solid ${vars.color.teal}`, borderRadius: "2px", background: "rgb(255 255 255 / 97%)", boxShadow: "0 18px 48px rgb(10 15 13 / 19%)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", "@media": { "screen and (max-width: 680px)": { width: "min(420px, calc(100% - 12px))" } } });
globalStyle(".dwim-panel.section-selection", { borderTopColor: vars.color.teal });
globalStyle(".dwim-heading", { minHeight: "52px", display: "grid", gridTemplateColumns: "31px minmax(0, 1fr) 31px", alignItems: "stretch", gap: 0, padding: 0, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".dwim-heading::before", { content: "attr(data-index)", display: "grid", placeItems: "center", background: vars.color.ink, color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "7px" });
globalStyle(".dwim-heading > div", { minWidth: 0, alignSelf: "center", padding: "6px 9px" });
globalStyle(".dwim-heading span", { display: "block", marginBottom: "2px", color: vars.color.tealDark, fontSize: "7px", fontWeight: 560, textTransform: "lowercase" });
globalStyle(".dwim-heading h2", { margin: 0, overflow: "hidden", fontSize: "21px", fontWeight: 300, lineHeight: 1.05, letterSpacing: "-.045em", textOverflow: "ellipsis", textTransform: "lowercase", whiteSpace: "nowrap" });
globalStyle(".dwim-command", { display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) auto", alignItems: "center", gap: "6px", margin: "9px 10px", padding: "6px 7px", border: `1px solid ${vars.color.line}`, borderRadius: "3px", background: vars.color.canvas, boxShadow: "inset 2px 2px 7px rgb(89 102 98 / 10%)" });
globalStyle(".dwim-command > span", { color: vars.color.tealDark, textAlign: "center" });
globalStyle(".dwim-command input", { width: "100%", minWidth: 0, padding: "4px", border: 0, outline: 0, background: "transparent", color: vars.color.ink, fontSize: "10px" });
globalStyle(".dwim-command button", { minHeight: "26px", padding: "4px 8px", border: 0, borderRadius: "2px", background: vars.color.tealDark, color: vars.color.panel, cursor: "pointer", fontSize: "9px", fontWeight: 560, textTransform: "lowercase" });
globalStyle(".dwim-status", { margin: "0 10px 8px", padding: "7px 8px", borderLeft: `3px solid ${vars.color.teal}`, background: vars.color.tealPale, color: vars.color.tealDark, fontSize: "8px", lineHeight: 1.4 });
globalStyle(".dwim-body", { minWidth: 0, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(150px, .78fr) minmax(180px, 1.22fr)", overflow: "hidden", borderTop: `1px solid ${vars.color.line}` });
globalStyle(".dwim-body > section", { minWidth: 0, minHeight: 0, overflow: "auto", padding: "9px 10px" });
globalStyle(".dwim-body > section + section", { borderLeft: `1px solid ${vars.color.line}` });
globalStyle(".dwim-section-label", { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "6px", marginBottom: "7px" });
globalStyle(".dwim-section-label b", { fontSize: "9px", fontWeight: 700, textTransform: "lowercase" });
globalStyle(".dwim-upload", { display: "inline-block", marginTop: "8px", color: vars.color.amethyst, cursor: "pointer", fontSize: "8px", fontWeight: 700, textTransform: "lowercase" });
globalStyle(".dwim-upload input", { display: "none" });
globalStyle(".visual-controls", { display: "block", overflow: "auto", overscrollBehavior: "contain", padding: 0 });
globalStyle(".visual-controls > section + section", { borderLeft: 0, borderTop: `1px solid ${vars.color.line}` });
globalStyle(".dwim-marks", { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "3px" });
globalStyle(".dwim-marks button", { minHeight: "27px", padding: "4px", border: `1px solid ${vars.color.line}`, borderRadius: "2px", background: vars.color.panel, color: vars.color.muted, cursor: "pointer", fontSize: "8px", textTransform: "lowercase" });
globalStyle(".dwim-marks button.active", { borderColor: vars.color.tealDark, background: vars.color.tealDark, color: vars.color.panel });
globalStyle(".dwim-visual-grid", { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "7px" });
globalStyle(".dwim-field", { display: "grid", gap: "3px", color: vars.color.muted, fontSize: "8px", fontWeight: 650, textTransform: "lowercase" });
globalStyle(".dwim-field select", { minWidth: 0, width: "100%", padding: "5px", border: `1px solid ${vars.color.line}`, borderRadius: "2px", background: vars.color.panel, color: vars.color.ink, fontSize: "8px" });
globalStyle(".dwim-selection", { minHeight: 0, overflow: "auto", padding: 0 });
globalStyle(".dwim-selection pre", { maxHeight: "210px", margin: 0, overflow: "auto", padding: "10px 11px", border: 0, borderBottom: `1px solid ${vars.color.line}`, background: vars.color.canvas, color: vars.color.ink, fontFamily: "ui-monospace, monospace", fontSize: "9px", lineHeight: 1.5, whiteSpace: "pre-wrap" });
globalStyle(".dwim-selection-actions", { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", margin: 0, borderLeft: `1px solid ${vars.color.line}` });
globalStyle(".dwim-selection button, .result-context-actions button", { minHeight: "34px", padding: "6px 8px", border: 0, borderRight: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}`, borderRadius: 0, background: vars.color.panel, color: vars.color.ink, cursor: "pointer", fontSize: "8px", fontWeight: 560, textAlign: "left", textTransform: "lowercase" });
globalStyle(".dwim-selection button:hover, .result-context-actions button:hover", { background: vars.color.tealPale, color: vars.color.tealDark });

globalStyle(".result-tabs", { minWidth: 0, display: "flex", alignItems: "stretch", padding: "0 11px", background: vars.color.canvas, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".result-tabs button", { display: "flex", alignItems: "flex-end", gap: "5px", padding: "0 11px 7px", border: 0, borderBottom: "3px solid transparent", background: "transparent", color: vars.color.muted, cursor: "pointer", fontSize: "12px", fontWeight: 320, letterSpacing: "-.03em", textTransform: "lowercase" });
globalStyle(".result-tabs button:first-child", { paddingLeft: 1 });
globalStyle(".result-tabs button.active", { borderBottomColor: vars.color.tealDark, color: vars.color.ink });
globalStyle(".result-tabs button span", { color: vars.color.tealDark, fontFamily: "ui-monospace, monospace", fontSize: "7px" });
globalStyle(".result-stage", { position: "relative", minWidth: 0, minHeight: 0, overflow: "hidden", background: vars.color.panel });
globalStyle(".result-stage > .chart-view-shell", { width: "100%", height: "100%" });

globalStyle(".result-table-shell", { position: "relative", width: "100%", height: "100%", minWidth: 0, minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr) auto", overflow: "hidden" });
globalStyle(".result-table-focus", { width: "100%", height: "100%", minWidth: 0, minHeight: 0, overflow: "hidden" });
globalStyle(".result-table-scroll", { minWidth: 0, minHeight: 0, overflow: "auto", overscrollBehavior: "contain" });
globalStyle(".result-table", { minWidth: "100%", borderCollapse: "collapse", fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", fontSize: "9px", userSelect: "none" });
globalStyle(".result-table th, .result-table td", { maxWidth: "320px", padding: "7px 9px", overflow: "hidden", borderRight: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}`, textAlign: "left", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".result-table th", { position: "sticky", top: 0, zIndex: vars.layer.sticky, height: "34px", padding: "4px 5px 5px 9px", background: vars.color.canvas, color: vars.color.muted, fontFamily: systemFont, fontWeight: 650 });
globalStyle(".result-table th.query-column", { background: vars.color.tealPale, color: vars.color.tealDark, boxShadow: `inset 0 -2px ${vars.color.tealDark}` });
globalStyle(".result-table td.query-column", { background: "rgb(60 187 177 / 6%)" });
globalStyle(".result-table td.range-selected", { background: "rgb(42 30 92 / 12%)", boxShadow: `inset 0 0 0 1px rgb(42 30 92 / 18%)` });
globalStyle(".column-add, .column-sort", { border: 0, background: "transparent", cursor: "pointer", fontSize: "inherit" });
globalStyle(".column-add", { minHeight: "24px", maxWidth: "calc(100% - 26px)", padding: "4px 1px", overflow: "hidden", color: "inherit", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 650 });
globalStyle(".query-column .column-add", { color: "#106c66" });
globalStyle(".column-add:hover", { color: vars.color.tealDark, textDecoration: "underline" });
globalStyle(".query-column .column-add:hover", { color: "#0b5f5a" });
globalStyle(".column-sort", { float: "right", width: "24px", height: "24px", padding: "4px", color: vars.color.strongLine });
globalStyle(".column-sort.active", { color: vars.color.amethyst, fontWeight: 800 });

globalStyle(".chart-interaction", { position: "relative", width: "100%", height: "100%", minWidth: 0, minHeight: 0, overflow: "hidden", outline: 0, cursor: "crosshair", touchAction: "none", userSelect: "none" });
globalStyle(".chart-embed, .chart-embed > div, .chart-embed .vega-embed", { width: "100%", height: "100%", maxWidth: "100%" });
globalStyle(".chart-interaction:focus-visible", { boxShadow: `inset 0 0 0 2px ${vars.color.teal}` });
globalStyle(".chart-selection-shade", { position: "absolute", inset: 0, zIndex: vars.layer.sticky, pointerEvents: "none" });
globalStyle(".chart-selection-shade > i", { position: "absolute", display: "block", background: "rgb(244 247 246 / 58%)" });
globalStyle(".chart-selection-shade > i:nth-child(1)", { inset: "0 0 auto", height: "var(--selection-top)" });
globalStyle(".chart-selection-shade > i:nth-child(2)", { left: 0, top: "var(--selection-top)", width: "var(--selection-left)", height: "calc(var(--selection-bottom) - var(--selection-top))" });
globalStyle(".chart-selection-shade > i:nth-child(3)", { right: 0, top: "var(--selection-top)", width: "calc(100% - var(--selection-right))", height: "calc(var(--selection-bottom) - var(--selection-top))" });
globalStyle(".chart-selection-shade > i:nth-child(4)", { inset: "var(--selection-bottom) 0 0" });
globalStyle(".chart-brush", { position: "absolute", zIndex: vars.layer.floatingControl, border: `1px solid ${vars.color.amethyst}`, background: "rgb(42 30 92 / 10%)", boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 55%)", pointerEvents: "none" });
globalStyle(".chart-brush.persistent", { borderWidth: "2px", background: "rgb(42 30 92 / 8%)", boxShadow: "0 0 0 1px rgb(255 255 255 / 72%), 0 4px 14px rgb(42 30 92 / 12%)" });
globalStyle(".chart-brush-summary", { position: "absolute", left: "8px", top: "8px", zIndex: 1, maxWidth: "min(280px, calc(100% - 16px))", display: "grid", gap: "2px", padding: "5px 7px", borderLeft: `3px solid ${vars.color.amethyst}`, background: "rgb(255 255 255 / 91%)", boxShadow: "0 4px 14px rgb(10 15 13 / 16%)", color: vars.color.ink, pointerEvents: "none" });
globalStyle(".chart-brush-summary b", { fontSize: "7px", fontWeight: 620, textTransform: "lowercase" });
globalStyle(".chart-brush-summary small", { overflow: "hidden", color: vars.color.muted, fontFamily: "ui-monospace, monospace", fontSize: "7px", lineHeight: 1.3, textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".chart-brush-handle", { position: "absolute", width: "13px", height: "13px", padding: 0, border: "2px solid white", borderRadius: "50%", background: vars.color.amethyst, boxShadow: "0 2px 7px rgb(10 15 13 / 28%)", pointerEvents: "auto" });
globalStyle(".chart-brush-handle.nw", { left: 0, top: 0, transform: "translate(-50%, -50%)", cursor: "nwse-resize" });
globalStyle(".chart-brush-handle.ne", { right: 0, top: 0, transform: "translate(50%, -50%)", cursor: "nesw-resize" });
globalStyle(".chart-brush-handle.sw", { left: 0, bottom: 0, transform: "translate(-50%, 50%)", cursor: "nesw-resize" });
globalStyle(".chart-brush-handle.se", { right: 0, bottom: 0, transform: "translate(50%, 50%)", cursor: "nwse-resize" });

globalStyle(".result-context", { position: "absolute", left: "12px", bottom: "12px", zIndex: vars.layer.popover, width: "min(390px, calc(100% - 24px))", maxHeight: "min(440px, calc(100% - 24px))", display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", padding: 0, overflow: "hidden", border: `1px solid ${vars.color.strongLine}`, borderTop: `4px solid ${vars.color.teal}`, borderRadius: "2px", background: "rgb(255 255 255 / 96%)", boxShadow: "0 18px 44px rgb(10 15 13 / 22%)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" });
globalStyle(".result-context.active-ai-context", { borderTopColor: vars.color.teal, boxShadow: "0 0 0 1px rgb(60 187 177 / 26%), 0 16px 42px rgb(10 15 13 / 20%)" });
globalStyle(".result-context header", { minHeight: "52px", display: "grid", gridTemplateColumns: "31px minmax(0, 1fr) 31px", alignItems: "stretch", gap: 0, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".result-context header::before", { content: "\"01\"", display: "grid", placeItems: "center", background: vars.color.ink, color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "7px" });
globalStyle(".result-context header > div", { alignSelf: "center", minWidth: 0, padding: "6px 9px" });
globalStyle(".result-context header span", { display: "block", marginBottom: "2px", color: vars.color.tealDark, fontSize: "7px", fontWeight: 560, textTransform: "lowercase" });
globalStyle(".result-context h2", { margin: 0, fontSize: "21px", fontWeight: 300, lineHeight: 1.05, letterSpacing: "-.045em", textTransform: "lowercase" });
globalStyle(".result-context header p", { maxWidth: "56ch", margin: "3px 0 0", overflow: "hidden", color: vars.color.muted, fontSize: "7px", lineHeight: 1.35, textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".result-context-body", { minHeight: 0, overflowX: "hidden", overflowY: "auto", overscrollBehavior: "contain", scrollbarColor: `${vars.color.strongLine} transparent`, scrollbarWidth: "thin" });
globalStyle(".result-context-items", { display: "flex", overflowX: "auto", borderBottom: `1px solid ${vars.color.line}`, scrollbarWidth: "thin" });
globalStyle(".result-context-items button", { flex: "0 0 auto", maxWidth: "190px", minHeight: "29px", overflow: "hidden", padding: "5px 8px", border: 0, borderRight: `1px solid ${vars.color.line}`, background: vars.color.canvas, color: vars.color.muted, cursor: "pointer", fontFamily: "ui-monospace, monospace", fontSize: "7px", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".result-context-items button.active", { background: vars.color.tealPale, color: vars.color.tealDark, boxShadow: `inset 0 -2px ${vars.color.teal}` });
globalStyle(".result-context-details dl", { maxHeight: "164px", overflowY: "auto", margin: 0, scrollbarColor: `${vars.color.strongLine} transparent`, scrollbarWidth: "thin" });
globalStyle(".result-context-details dl > div", { minHeight: "28px", display: "grid", gridTemplateColumns: "minmax(96px, .85fr) minmax(0, 1.15fr)", alignItems: "stretch", borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".result-context-details dt, .result-context-details dd", { minWidth: 0, display: "grid", alignItems: "center", margin: 0, padding: "6px 8px", overflow: "hidden", fontSize: "8px", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".result-context-details dt", { borderRight: `1px solid ${vars.color.line}`, background: vars.color.canvas, color: vars.color.muted, fontFamily: "ui-monospace, monospace" });
globalStyle(".result-context-details dd", { color: vars.color.ink, fontWeight: 560, textAlign: "right" });
globalStyle(".result-context-details p", { margin: 0, padding: "6px 9px", borderBottom: `1px solid ${vars.color.line}`, color: vars.color.muted, fontSize: "7px" });
globalStyle(".result-context-actions", { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", margin: 0, borderTop: `1px solid ${vars.color.line}`, borderLeft: `1px solid ${vars.color.line}` });
globalStyle(".result-context-status", { margin: "7px 9px", padding: "6px 7px", borderLeft: `3px solid ${vars.color.teal}`, background: vars.color.tealPale, color: vars.color.tealDark, fontSize: "8px", lineHeight: 1.35 });

/* General AI is a reading surface over the app, not a detached chat widget. */
globalStyle(".ai-overlay.context-code", { "@media": { "screen and (max-width: 960px)": { left: "360px" } } });
globalStyle(".ai-overlay.context-chart, .ai-overlay.context-general", { "@media": { "screen and (max-width: 960px)": { width: "360px" } } });
globalStyle(".topbar", { "@media": { "screen and (max-width: 680px)": { gridTemplateColumns: "1fr auto", padding: "0 10px" } } });
globalStyle(".topbar nav", { "@media": { "screen and (max-width: 680px)": { gap: "9px" } } });
globalStyle(".topbar nav a", { "@media": { "screen and (max-width: 680px)": { fontSize: "9px" } } });
globalStyle(".chart-header", { "@media": { "screen and (max-width: 680px)": { gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "start" } } });
globalStyle(".chart-status", { "@media": { "screen and (max-width: 680px)": { display: "none" } } });
globalStyle(".ai-overlay.context-code, .ai-overlay.context-chart, .ai-overlay.context-general", { "@media": { "screen and (max-width: 680px)": { inset: 0, width: "100%" } } });
globalStyle(".ai-overlay::before", { "@media": { "screen and (max-width: 680px)": { maskImage: "none", WebkitMaskImage: "none" } } });
globalStyle(".ai-surface, .context-code .ai-surface", { "@media": { "screen and (max-width: 680px)": { width: "100%", padding: "52px 16px 14px" } } });
globalStyle(".principle-grid", { "@media": { "screen and (max-width: 680px)": { gridTemplateColumns: "1fr" } } });
globalStyle(".principle-grid article", { "@media": { "screen and (max-width: 680px)": { borderRight: 0, borderBottom: `1px solid ${vars.color.line}` } } });
globalStyle(".admin-heading", { "@media": { "screen and (max-width: 680px)": { display: "block" } } });
globalStyle(".privacy-badge", { "@media": { "screen and (max-width: 680px)": { display: "inline-block", marginTop: "10px" } } });
globalStyle(".admin-form", { "@media": { "screen and (max-width: 680px)": { gridTemplateColumns: "1fr" } } });
globalStyle(".admin-form .wide", { "@media": { "screen and (max-width: 680px)": { gridColumn: "auto" } } });
globalStyle(".dataset-row", { "@media": { "screen and (max-width: 680px)": { gridTemplateColumns: "1fr auto" } } });
globalStyle(".dataset-row > span", { "@media": { "screen and (max-width: 680px)": { display: "none" } } });
/* Cursor-led editor and source dock. */
globalStyle(".workbench-grid.dwim-layout", { position: "relative", gridTemplateColumns: "clamp(460px, var(--left-pane-size, 44%), calc(100% - 460px)) minmax(0, 1fr)", "@media": { "screen and (max-width: 960px)": { gridTemplateColumns: "clamp(440px, var(--left-pane-size, 48%), calc(100% - 440px)) minmax(0, 1fr)" }, "screen and (max-width: 680px)": { minWidth: "900px", gridTemplateColumns: "clamp(440px, var(--left-pane-size, 48%), calc(100% - 440px)) minmax(0, 1fr)" } } });
globalStyle(".editor-stack", { position: "relative", width: "100%", height: "100%", minWidth: 0, minHeight: 0, display: "grid", gridTemplateRows: "clamp(220px, var(--code-pane-size, 56%), calc(100% - 220px)) minmax(0, 1fr)", overflow: "hidden" });
globalStyle(".editor-stack > .code-pane", { height: "100%", minHeight: 0 });
globalStyle(".editor-workspace .code-toolbar strong span", { color: vars.color.muted, fontSize: "11px", fontWeight: 420, letterSpacing: "-.02em" });
globalStyle(".editor-workspace .code-toolbar small", { display: "block", marginTop: "4px", color: vars.color.muted, fontSize: "8px", fontWeight: 450 });

globalStyle(".panel-resizer", { position: "absolute", zIndex: vars.layer.floatingControl, display: "grid", placeItems: "center", padding: 0, overflow: "visible", border: 0, background: "transparent", touchAction: "none", userSelect: "none" });
globalStyle(".panel-resizer::before", { content: "", position: "absolute", zIndex: vars.layer.content, background: vars.color.line, transition: "background 120ms ease, box-shadow 120ms ease" });
globalStyle(".panel-resizer span", { position: "relative", zIndex: vars.layer.sticky, display: "block", borderRadius: "999px", background: vars.color.strongLine, opacity: .48, transition: "opacity 120ms ease, background 120ms ease" });
globalStyle(".panel-resizer.vertical", { top: 0, bottom: 0, left: "clamp(460px, var(--left-pane-size, 44%), calc(100% - 460px))", width: "7px", cursor: "col-resize", transform: "translateX(-50%)", "@media": { "screen and (max-width: 960px)": { left: "clamp(440px, var(--left-pane-size, 48%), calc(100% - 440px))" } } });
globalStyle(".panel-resizer.vertical::before", { top: 0, bottom: 0, left: "3px", width: "1px" });
globalStyle(".panel-resizer.vertical span", { width: "3px", height: "34px" });
globalStyle(".panel-resizer.horizontal", { top: "clamp(220px, var(--code-pane-size, 56%), calc(100% - 220px))", right: 0, left: 0, height: "7px", cursor: "row-resize", transform: "translateY(-50%)" });
globalStyle(".panel-resizer.horizontal::before", { top: "3px", right: 0, left: 0, height: "1px" });
globalStyle(".panel-resizer.horizontal span", { width: "34px", height: "3px" });
globalStyle(".panel-resizer:hover::before, .panel-resizer:focus-visible::before", { background: vars.color.tealDark, boxShadow: "0 0 0 2px rgb(60 187 177 / 20%)" });
globalStyle(".panel-resizer:hover span, .panel-resizer:focus-visible span", { background: vars.color.tealDark, opacity: 1 });
globalStyle("body.resizing-panels", { cursor: "grabbing", userSelect: "none" });

globalStyle(".source-dock", { position: "relative", minWidth: 0, minHeight: 0, display: "grid", gridTemplateRows: "38px 31px minmax(0, 1fr)", overflow: "hidden", background: vars.color.panel });
globalStyle(".source-dock-toolbar", { minWidth: 0, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".source-dock-toolbar > div", { minWidth: 0 });
globalStyle(".data-upload-control", { position: "relative", flex: "0 0 auto" });
globalStyle(".data-upload-control > summary", { minHeight: "27px", display: "flex", alignItems: "center", gap: "5px", padding: "4px 7px", border: 0, borderBottom: `1px solid ${vars.color.tealDark}`, background: "transparent", color: vars.color.tealDark, cursor: "pointer", listStyle: "none", fontSize: "8px", fontWeight: 560, textTransform: "lowercase" });
globalStyle(".data-upload-control > summary::-webkit-details-marker", { display: "none" });
globalStyle(".data-upload-control > summary:hover, .data-upload-control[open] > summary", { background: vars.color.tealPale });
globalStyle(".data-upload-control > summary svg", { width: "14px", height: "14px", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" });
globalStyle(".data-upload-menu", { position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: vars.layer.top, width: "min(430px, 88vw)", overflow: "hidden", border: `1px solid ${vars.color.strongLine}`, borderTop: `4px solid ${vars.color.teal}`, background: "rgb(255 255 255 / 98%)", boxShadow: "0 18px 48px rgb(10 15 13 / 21%)" });
globalStyle(".data-upload-menu > header", { minHeight: "44px", display: "grid", gridTemplateColumns: "36px minmax(0, 1fr)", alignItems: "stretch", borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".data-upload-menu > header i", { display: "grid", placeItems: "center", background: vars.color.ink, color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "7px", fontStyle: "normal" });
globalStyle(".data-upload-menu > header span", { display: "grid", alignContent: "center", gap: "1px", padding: "6px 9px" });
globalStyle(".data-upload-menu > header b", { fontSize: "15px", fontWeight: 340, textTransform: "lowercase" });
globalStyle(".data-upload-menu > header small", { color: vars.color.muted, fontSize: "7px" });
globalStyle(".data-upload-menu > section", { display: "grid", justifyItems: "start", gap: "6px", padding: "15px", background: "linear-gradient(135deg, rgb(221 245 242 / 68%), rgb(255 255 255 / 96%))", boxShadow: "inset 0 0 0 2px transparent", transition: "background 120ms ease, box-shadow 120ms ease" });
globalStyle(".data-upload-menu > section.drop-active", { background: "linear-gradient(135deg, rgb(200 238 233 / 96%), rgb(221 245 242 / 92%))", boxShadow: `inset 0 0 0 2px ${vars.color.teal}` });
globalStyle(".data-upload-menu > section strong", { fontSize: "17px", fontWeight: 340, letterSpacing: "-.03em", textTransform: "lowercase" });
globalStyle(".data-upload-menu > section p", { maxWidth: "360px", margin: 0, color: vars.color.muted, fontSize: "8px", lineHeight: 1.5 });
globalStyle(".data-upload-menu label", { cursor: "pointer", textTransform: "lowercase" });
globalStyle(".data-upload-menu input", { display: "none" });
globalStyle(".data-upload-primary", { minHeight: "38px", display: "inline-flex", alignItems: "center", gap: "7px", marginTop: "4px", padding: "8px 12px", background: vars.color.tealDark, color: vars.color.panel, fontSize: "10px", fontWeight: 590 });
globalStyle(".data-upload-primary:hover, .data-upload-primary:focus-within", { background: "#0f6d67" });
globalStyle(".data-upload-primary svg", { width: "17px", height: "17px", flex: "0 0 auto", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" });
globalStyle(".data-upload-drop-hint", { color: vars.color.tealDark, fontFamily: "ui-monospace, monospace", fontSize: "6.5px" });
globalStyle(".data-upload-menu > footer", { minHeight: "39px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "9px", padding: "6px 9px", borderTop: `1px solid ${vars.color.line}` });
globalStyle(".data-upload-menu > footer label", { minHeight: "29px", display: "inline-flex", alignItems: "center", gap: "5px", padding: "5px 9px", border: `1px solid ${vars.color.tealDark}`, borderLeftWidth: "3px", background: vars.color.tealPale, color: vars.color.tealDark, fontSize: "8px", fontWeight: 560, transition: "background 120ms ease, color 120ms ease" });
globalStyle(".data-upload-menu > footer label:hover, .data-upload-menu > footer label:focus-within", { background: "#c8eee9", color: vars.color.tealDark });
globalStyle(".data-upload-menu > footer label svg", { width: "13px", height: "13px", flex: "0 0 auto", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" });
globalStyle(".data-upload-menu > footer small", { color: vars.color.muted, fontFamily: "ui-monospace, monospace", fontSize: "6px" });
globalStyle(".source-drop-overlay", { position: "absolute", inset: 0, zIndex: vars.layer.top, display: "grid", placeContent: "center", justifyItems: "center", gap: "5px", border: `2px dashed ${vars.color.tealDark}`, background: "rgb(221 245 242 / 88%)", color: vars.color.tealDark, textAlign: "center", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", pointerEvents: "none" });
globalStyle(".source-drop-overlay > span", { fontSize: "28px", fontWeight: 300 });
globalStyle(".source-drop-overlay > b", { fontSize: "16px", fontWeight: 340, textTransform: "lowercase" });
globalStyle(".source-drop-overlay > small", { color: vars.color.muted, fontSize: "7px" });
globalStyle(".source-dock-tabs", { position: "relative", zIndex: vars.layer.sticky, minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 31px", background: vars.color.canvas, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".source-dock-tabs nav", { minWidth: 0, display: "flex", overflowX: "auto", scrollbarWidth: "none" });
globalStyle(".source-dock-tabs nav button", { minWidth: "128px", maxWidth: "220px", overflow: "hidden", padding: "4px 9px 3px", border: 0, borderRight: `1px solid ${vars.color.line}`, borderBottom: "3px solid transparent", background: "transparent", color: vars.color.muted, cursor: "pointer", textAlign: "left", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "9px", fontWeight: 420, textTransform: "lowercase" });
globalStyle(".source-dock-tabs nav button.active", { borderBottomColor: vars.color.tealDark, background: vars.color.panel, color: vars.color.ink });
globalStyle(".source-dock-add", { position: "relative" });
globalStyle(".source-dock-add > summary, .inline-source-control > summary, .dwim-column-picker > summary", { width: "100%", height: "100%", display: "grid", placeItems: "center", border: 0, background: vars.color.tealDark, color: vars.color.panel, cursor: "pointer", listStyle: "none", fontSize: "19px", fontWeight: 300 });
globalStyle(".source-dock-add > summary::-webkit-details-marker, .inline-source-control > summary::-webkit-details-marker, .dwim-column-picker > summary::-webkit-details-marker", { display: "none" });
globalStyle(".source-dock-add > div", { position: "absolute", top: "calc(100% + 1px)", right: 0, zIndex: vars.layer.popover, width: "min(620px, 86vw)", maxHeight: "340px", overflow: "auto", padding: 0, border: `1px solid ${vars.color.strongLine}`, borderTop: `4px solid ${vars.color.teal}`, borderRadius: "2px", background: "rgb(255 255 255 / 98%)", boxShadow: "0 18px 44px rgb(10 15 13 / 20%)" });
globalStyle(".source-dock-add > div > header", { minHeight: "39px", display: "grid", gridTemplateColumns: "35px minmax(0, 1fr) auto", alignItems: "stretch", gap: 0, margin: 0, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".source-dock-add > div > header::before", { content: "\"01\"", display: "grid", placeItems: "center", background: vars.color.ink, color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "7px" });
globalStyle(".source-dock-add > div > header b", { alignSelf: "center", padding: "0 9px", fontSize: "18px", fontWeight: 300, letterSpacing: "-.04em" });
globalStyle(".source-dock-add > div > header span", { alignSelf: "center", paddingRight: "9px", color: vars.color.tealDark, fontFamily: "ui-monospace, monospace", fontSize: "7px" });
globalStyle(".source-dock-body", { position: "relative", minWidth: 0, minHeight: 0, overflow: "hidden" });

globalStyle(".dwim-command.ai-promoter, .result-context-ai", { width: "auto", minHeight: "38px", display: "grid", gridTemplateColumns: "20px minmax(0, 1fr) auto", alignItems: "center", gap: "7px", margin: "7px 9px", padding: "5px 7px", border: `1px solid ${vars.color.line}`, borderLeft: `3px solid ${vars.color.teal}`, borderRadius: "2px", background: "rgb(231 237 235 / 52%)", color: vars.color.muted, cursor: "text", textAlign: "left", boxShadow: "inset 3px 3px 10px rgb(42 30 92 / 8%), inset -3px -3px 10px rgb(255 255 255 / 84%)" });
globalStyle(".dwim-command.ai-promoter > span:first-child, .result-context-ai > span:first-child", { color: vars.color.tealDark, fontSize: "12px" });
globalStyle(".dwim-command.ai-promoter input, .result-context-ai input", { width: "100%", minWidth: 0, padding: "4px 2px", border: 0, outline: 0, background: "transparent", color: vars.color.ink, cursor: "text", fontSize: "8px", fontWeight: 520 });
globalStyle(".dwim-command.ai-promoter input::placeholder, .result-context-ai input::placeholder", { color: vars.color.muted, opacity: 1 });
globalStyle(".dwim-command.ai-promoter > b, .result-context-ai > b", { color: vars.color.tealDark, fontSize: "8px", textTransform: "lowercase" });
globalStyle(".result-context-ai.active", { borderColor: vars.color.tealDark, background: vars.color.tealPale, boxShadow: "inset 3px 3px 10px rgb(42 30 92 / 6%), 0 0 0 1px rgb(60 187 177 / 18%)" });
globalStyle(".dwim-body.sql-controls", { display: "block", overflow: "auto" });
globalStyle(".dwim-body.sql-controls > section", { overflow: "visible", padding: 0 });
globalStyle(".dwim-body.sql-controls > section + section", { borderTop: `1px solid ${vars.color.line}`, borderLeft: 0 });
globalStyle(".dwim-column-section-body", { padding: "8px 9px" });
globalStyle(".sql-controls .dwim-upload", { minHeight: "34px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", margin: 0, padding: "6px 9px", borderBottom: `1px solid ${vars.color.line}`, color: vars.color.amethyst });
globalStyle(".sql-controls .dwim-upload small", { color: vars.color.muted, fontFamily: "ui-monospace, monospace", fontSize: "6px", fontWeight: 500 });
globalStyle(".dwim-source-search", { position: "relative", minWidth: 0, padding: "8px 9px" });
globalStyle(".dwim-source-search > label, .dwim-column-browser > label", { minHeight: "32px", display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) auto", alignItems: "center", gap: "5px", padding: "0 7px", border: `1px solid ${vars.color.strongLine}`, background: vars.color.canvas, color: vars.color.tealDark });
globalStyle(".dwim-source-search > label > span, .dwim-column-browser > label > span", { fontSize: "15px", fontWeight: 350, lineHeight: 1 });
globalStyle(".dwim-source-search input, .dwim-column-browser input", { width: "100%", minWidth: 0, height: "29px", padding: 0, border: 0, outline: 0, background: "transparent", color: vars.color.ink, fontSize: "8px", fontWeight: 520 });
globalStyle(".dwim-source-search input::placeholder, .dwim-column-browser input::placeholder", { color: vars.color.muted, opacity: 1 });
globalStyle(".dwim-source-search > label small", { color: vars.color.muted, fontFamily: "ui-monospace, monospace", fontSize: "6px" });
globalStyle(".dwim-source-results", { maxHeight: "180px", overflow: "auto", borderRight: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}`, borderLeft: `1px solid ${vars.color.line}`, scrollbarColor: `${vars.color.strongLine} transparent`, scrollbarWidth: "thin" });
globalStyle(".dwim-source-results > button", { width: "100%", minHeight: "36px", display: "grid", gridTemplateColumns: "24px minmax(0, 1fr) auto", alignItems: "stretch", gap: 0, padding: 0, border: 0, borderBottom: `1px solid ${vars.color.line}`, borderRadius: 0, background: vars.color.panel, color: vars.color.ink, cursor: "pointer", textAlign: "left" });
globalStyle(".dwim-source-results > button:last-of-type", { borderBottom: 0 });
globalStyle(".dwim-source-results > button:hover", { background: vars.color.tealPale });
globalStyle(".dwim-source-results > button.active", { background: vars.color.tealPale, boxShadow: `inset 3px 0 ${vars.color.tealDark}` });
globalStyle(".dwim-source-results > button:disabled", { cursor: "not-allowed", opacity: .42 });
globalStyle(".dwim-source-results > button > i", { display: "grid", placeItems: "center", color: vars.color.tealDark, fontSize: "10px", fontStyle: "normal", fontWeight: 760 });
globalStyle(".dwim-source-results > button > span", { minWidth: 0, alignSelf: "center", display: "grid", gap: "1px", padding: "5px 7px" });
globalStyle(".dwim-source-results > button b", { overflow: "hidden", fontSize: "8px", fontWeight: 590, textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".dwim-source-results > button small", { overflow: "hidden", color: vars.color.muted, fontFamily: "ui-monospace, monospace", fontSize: "6px", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".dwim-source-results > button em", { alignSelf: "center", padding: "0 7px", color: vars.color.muted, fontFamily: "ui-monospace, monospace", fontSize: "6px", fontStyle: "normal" });
globalStyle(".dwim-source-results > p", { margin: 0, padding: "14px 9px", color: vars.color.muted, fontSize: "8px" });
globalStyle(".source-search-loading", { position: "absolute", inset: "8px 9px", zIndex: vars.layer.chrome, display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", background: "rgb(255 255 255 / 72%)", color: vars.color.tealDark, backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", fontSize: "8px", fontWeight: 600 });
globalStyle(".source-search-loading .spinner", { width: "14px", height: "14px" });

globalStyle(".dwim-panel.section-visual", { width: "min(560px, calc(100vw - var(--dwim-left) - 12px))", maxHeight: "min(590px, calc(100vh - 52px))" });
globalStyle(".visual-controls", { scrollbarColor: `${vars.color.strongLine} transparent`, scrollbarWidth: "thin" });
globalStyle(".visual-controls > .visual-primary-section", { overflow: "visible", padding: 0, borderLeft: 0 });
globalStyle(".visual-controls > .visual-primary-section + .visual-primary-section, .visual-controls > .visual-primary-section + .visual-disclosure, .visual-controls > .visual-disclosure + .visual-disclosure", { borderTop: `1px solid ${vars.color.strongLine}` });
globalStyle(".dwim-section-heading", { minHeight: "30px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "0 8px 0 0", borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".dwim-section-heading b", { alignSelf: "stretch", display: "flex", alignItems: "center", gap: "7px", fontSize: "9px", fontWeight: 720, letterSpacing: ".02em", textTransform: "lowercase" });
globalStyle(".dwim-section-heading b > span", { width: "31px", alignSelf: "stretch", display: "grid", placeItems: "center", background: vars.color.ink, color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "7px", letterSpacing: 0 });
globalStyle(".dwim-section-heading small", { minWidth: 0, overflow: "hidden", color: vars.color.tealDark, fontFamily: "ui-monospace, monospace", fontSize: "7px", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".dwim-section-heading + .visual-primary-grid, .dwim-section-heading + .dwim-source-tiles", { borderTop: 0 });
globalStyle(".visual-primary-marks, .visual-secondary-marks", { display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", borderTop: `1px solid ${vars.color.line}`, borderLeft: `1px solid ${vars.color.line}` });
globalStyle(".visual-primary-marks button, .visual-secondary-marks button", { minWidth: 0, minHeight: "36px", display: "flex", alignItems: "flex-end", justifyContent: "flex-start", padding: "5px 6px", border: 0, borderRight: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}`, borderRadius: 0, background: vars.color.panel, color: vars.color.muted, cursor: "pointer", fontSize: "8px", fontWeight: 560, textTransform: "lowercase" });
globalStyle(".visual-primary-marks button:hover, .visual-secondary-marks button:hover", { background: vars.color.tealPale, color: vars.color.ink });
globalStyle(".visual-primary-marks button.active, .visual-secondary-marks button.active", { background: vars.color.tealDark, color: vars.color.panel, boxShadow: `inset 0 -3px ${vars.color.teal}` });
globalStyle(".visual-requirement", { minHeight: "42px", display: "grid", gridTemplateColumns: "31px minmax(0, 1fr) auto", alignItems: "stretch", borderTop: `1px solid ${vars.color.line}`, background: vars.color.canvas });
globalStyle(".visual-requirement > span", { display: "grid", placeItems: "center", color: vars.color.panel, background: vars.color.tealDark, fontFamily: "ui-monospace, monospace", fontSize: "9px" });
globalStyle(".visual-requirement.attention > span", { background: vars.color.watermelon });
globalStyle(".visual-requirement > div", { minWidth: 0, display: "grid", alignContent: "center", gap: "2px", padding: "6px 8px" });
globalStyle(".visual-requirement b", { color: vars.color.ink, fontSize: "8px", fontWeight: 590, textTransform: "lowercase" });
globalStyle(".visual-requirement p", { margin: 0, color: vars.color.muted, fontSize: "7px", lineHeight: 1.35 });
globalStyle(".visual-requirement > button", { alignSelf: "stretch", minWidth: "86px", padding: "5px 7px", border: 0, borderLeft: `1px solid ${vars.color.line}`, background: vars.color.panel, color: vars.color.tealDark, cursor: "pointer", fontSize: "7px", fontWeight: 590, textTransform: "lowercase" });
globalStyle(".visual-requirement > button:hover", { background: vars.color.tealPale });
globalStyle(".visual-secondary-marks", { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" });
globalStyle(".visual-primary-grid, .visual-disclosure-body", { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderTop: `1px solid ${vars.color.line}`, borderLeft: `1px solid ${vars.color.line}` });
globalStyle(".visual-title-grid", { gridTemplateColumns: "minmax(0, 1fr)" });
globalStyle(".visual-channel-grid", { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" });
globalStyle(".visual-controls .dwim-field", { minWidth: 0, display: "grid", gap: "4px", padding: "6px", borderRight: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}`, color: vars.color.muted, fontSize: "7px", fontWeight: 680, textTransform: "lowercase" });
globalStyle(".visual-controls .dwim-field select, .visual-controls .dwim-field input", { minWidth: 0, width: "100%", height: "27px", padding: "3px 1px", border: 0, borderBottom: `1px solid ${vars.color.strongLine}`, borderRadius: 0, outline: 0, background: "transparent", color: vars.color.ink, fontSize: "8px", fontWeight: 590 });
globalStyle(".visual-controls .dwim-field input[type='text']", { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace", fontWeight: 500, letterSpacing: "-.01em" });
globalStyle(".visual-controls .dwim-field select:focus, .visual-controls .dwim-field input:focus", { borderBottomColor: vars.color.tealDark, boxShadow: `0 1px ${vars.color.tealDark}` });
globalStyle(".visual-controls .dwim-color-field", { alignContent: "start" });
globalStyle(".native-color-control", { minWidth: 0, display: "grid", gridTemplateColumns: "33px minmax(0, 1fr) 20px", alignItems: "center", gap: "5px" });
globalStyle(".visual-controls .dwim-color-field .native-color-control input[type='color']", { width: "33px", height: "25px", padding: 0, overflow: "hidden", border: `1px solid ${vars.color.strongLine}`, borderRadius: "1px", background: "transparent", boxShadow: "none", cursor: "pointer" });
globalStyle(".native-color-control input[type='color']::-webkit-color-swatch-wrapper", { padding: "2px" });
globalStyle(".native-color-control input[type='color']::-webkit-color-swatch", { border: 0, borderRadius: 0 });
globalStyle(".native-color-control output", { minWidth: 0, overflow: "hidden", color: vars.color.ink, fontFamily: "ui-monospace, monospace", fontSize: "7px", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".dwim-color-field.automatic .native-color-control output", { color: vars.color.muted, fontFamily: systemFont });
globalStyle(".native-color-control button", { width: "20px", height: "20px", padding: 0, border: 0, borderRadius: 0, background: "transparent", color: vars.color.muted, cursor: "pointer", fontSize: "14px", fontWeight: 400 });
globalStyle(".visual-inline-disclosure, .visual-disclosure", { minWidth: 0 });
globalStyle(".visual-inline-disclosure > summary, .visual-disclosure > summary", { minHeight: "29px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto 15px", alignItems: "center", gap: "8px", padding: "5px 8px", border: 0, background: vars.color.canvas, color: vars.color.muted, cursor: "pointer", listStyle: "none", fontSize: "7px", textTransform: "lowercase" });
globalStyle(".visual-inline-disclosure > summary::-webkit-details-marker, .visual-disclosure > summary::-webkit-details-marker", { display: "none" });
globalStyle(".visual-inline-disclosure > summary::after, .visual-disclosure > summary::after", { content: "+", color: vars.color.tealDark, fontSize: "13px", fontWeight: 300, lineHeight: 1, textAlign: "center" });
globalStyle(".visual-inline-disclosure[open] > summary::after, .visual-disclosure[open] > summary::after", { content: "−" });
globalStyle(".visual-inline-disclosure > summary:hover, .visual-inline-disclosure[open] > summary, .visual-disclosure > summary:hover, .visual-disclosure[open] > summary", { background: vars.color.tealPale, color: vars.color.ink });
globalStyle(".visual-inline-disclosure > summary b, .visual-disclosure > summary b", { maxWidth: "210px", overflow: "hidden", color: vars.color.tealDark, fontFamily: "ui-monospace, monospace", fontSize: "6.5px", fontWeight: 550, textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".visual-disclosure > summary", { minHeight: "34px", background: vars.color.panel });
globalStyle(".visual-disclosure > summary span", { display: "flex", alignItems: "center", gap: "8px", color: vars.color.ink, fontSize: "8px", fontWeight: 700 });
globalStyle(".visual-disclosure > summary span i", { width: "23px", color: vars.color.tealDark, fontFamily: "ui-monospace, monospace", fontSize: "7px", fontStyle: "normal", fontWeight: 500 });
globalStyle(".visual-disclosure-body.labels-grid", { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" });
globalStyle(".dwim-field input", { minWidth: 0, width: "100%", padding: "5px", border: `1px solid ${vars.color.line}`, borderRadius: "2px", background: vars.color.panel, color: vars.color.ink, fontSize: "8px" });
globalStyle(".dwim-scale-groups", { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderTop: `1px solid ${vars.color.line}`, borderLeft: `1px solid ${vars.color.line}` });
globalStyle(".dwim-scale-groups > div", { minWidth: 0, display: "grid", gridTemplateColumns: "1fr", gap: 0, padding: 0, borderRight: `1px solid ${vars.color.line}` });
globalStyle(".dwim-scale-groups > div > b", { minHeight: "25px", display: "flex", alignItems: "center", padding: "4px 6px", borderBottom: `1px solid ${vars.color.line}`, color: vars.color.tealDark, fontSize: "7px", fontWeight: 700, textTransform: "lowercase" });

globalStyle(".dwim-source-tiles", { position: "relative", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", borderTop: `1px solid ${vars.color.line}`, borderLeft: `1px solid ${vars.color.line}` });
globalStyle(".dwim-source-tile", { position: "relative", minWidth: 0, borderRight: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}`, background: vars.color.panel });
globalStyle(".dwim-source-tile:hover", { background: vars.color.tealPale });
globalStyle(".dwim-source-tile.active", { background: vars.color.tealPale, boxShadow: `inset 3px 0 ${vars.color.tealDark}` });
globalStyle(".dwim-source-choice", { width: "100%", minWidth: 0, display: "grid", gridTemplateColumns: "17px minmax(0, 1fr)", gap: "2px 4px", padding: "8px 25px 8px 8px", border: 0, borderRadius: 0, background: "transparent", color: vars.color.ink, cursor: "pointer", textAlign: "left" });
globalStyle(".dwim-source-choice > span", { gridRow: "1 / span 2", color: vars.color.tealDark, fontSize: "10px", fontWeight: 800 });
globalStyle(".dwim-source-remove", { position: "absolute", top: "5px", right: "5px", width: "17px", height: "17px", padding: 0, border: 0, borderRadius: 0, background: "transparent", color: vars.color.muted, fontSize: "13px", lineHeight: "17px", cursor: "pointer" });
globalStyle(".dwim-source-remove:hover", { color: vars.color.watermelon });
globalStyle(".dwim-source-tiles strong", { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "9px", fontWeight: 560 });
globalStyle(".dwim-source-tiles small", { minWidth: 0, overflow: "hidden", color: vars.color.muted, textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "7px" });
globalStyle(".dwim-source-tiles.compact", { gridTemplateColumns: "repeat(2, minmax(170px, 1fr))" });
globalStyle(".source-tiles-loading", { gridColumn: "1 / -1", minHeight: "42px", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", borderRight: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}`, background: "linear-gradient(90deg, rgb(221 245 242 / 45%), rgb(255 255 255 / 88%), rgb(221 245 242 / 45%))", color: vars.color.tealDark, fontSize: "8px", fontWeight: 650, textTransform: "lowercase" });
globalStyle(".source-tiles-loading .spinner", { width: "14px", height: "14px" });

globalStyle(".dwim-column-control", { position: "relative", minWidth: 0, display: "grid", gap: "6px" });
globalStyle(".dwim-column-control.compact", { display: "flex", alignItems: "center" });
globalStyle(".dwim-selected-fields", { minWidth: 0, display: "flex", flexWrap: "wrap", gap: "3px" });
globalStyle(".dwim-selected-fields > button", { display: "flex", alignItems: "center", gap: "4px", padding: "4px 6px", border: 0, borderBottom: `1px solid ${vars.color.teal}`, borderRadius: 0, background: vars.color.tealPale, color: vars.color.tealDark, cursor: "pointer", fontFamily: "ui-monospace, monospace", fontSize: "7px" });
globalStyle(".dwim-selected-fields > button span", { color: vars.color.muted, fontSize: "10px" });
globalStyle(".dwim-column-picker", { position: "relative", flex: "0 0 auto", width: "28px", height: "28px" });
globalStyle(".dwim-column-picker > summary", { borderRadius: "50%" });
globalStyle(".dwim-column-browser", { minWidth: 0, display: "grid" });
globalStyle(".dwim-column-browser > label", { gridTemplateColumns: "18px minmax(0, 1fr)", borderBottom: 0 });
globalStyle(".dwim-column-menu", { position: "absolute", top: "calc(100% + 5px)", right: 0, zIndex: vars.layer.popover, width: "min(520px, calc(100vw - 42px))", maxHeight: "290px", overflow: "auto", padding: 0, border: `1px solid ${vars.color.strongLine}`, borderTop: `4px solid ${vars.color.teal}`, borderRadius: "2px", background: vars.color.panel, boxShadow: "0 16px 40px rgb(10 15 13 / 19%)" });
globalStyle(".section-sql .dwim-column-browser .dwim-column-menu", { position: "static", width: "auto", maxHeight: "220px", borderTop: `1px solid ${vars.color.strongLine}`, borderRadius: 0, boxShadow: "none", scrollbarColor: `${vars.color.strongLine} transparent`, scrollbarWidth: "thin" });
globalStyle(".dwim-column-menu section + section", { marginTop: 0, paddingTop: 0, borderTop: `1px solid ${vars.color.strongLine}` });
globalStyle(".dwim-column-menu section > header", { minHeight: "31px", display: "grid", gridTemplateColumns: "31px minmax(0, 1fr) auto", alignItems: "stretch", gap: 0, margin: 0, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".dwim-column-menu section > header::before", { content: "\"+\"", display: "grid", placeItems: "center", background: vars.color.ink, color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "9px" });
globalStyle(".dwim-column-menu section > header b", { alignSelf: "center", minWidth: 0, overflow: "hidden", padding: "0 7px", fontSize: "9px", fontWeight: 600, textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".dwim-column-menu section > header span", { alignSelf: "center", maxWidth: "190px", overflow: "hidden", paddingRight: "7px", color: vars.color.muted, fontFamily: "ui-monospace, monospace", fontSize: "6px", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".dwim-column-menu section > div", { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderTop: `1px solid ${vars.color.line}`, borderLeft: `1px solid ${vars.color.line}` });
globalStyle(".dwim-column-menu section > div button", { minWidth: 0, display: "grid", gridTemplateColumns: "12px minmax(0, 1fr)", padding: "5px", overflow: "hidden", border: 0, borderRight: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}`, background: vars.color.panel, color: vars.color.muted, cursor: "pointer", textAlign: "left", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "7px" });
globalStyle(".dwim-column-menu section > div button.active", { background: vars.color.tealPale, color: vars.color.tealDark });
globalStyle(".dwim-column-menu section > div button:hover", { background: vars.color.tealPale, color: vars.color.ink });
globalStyle(".dwim-column-menu section > div button b", { minWidth: 0, overflow: "hidden", fontSize: "7px", fontWeight: 560, textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".dwim-column-menu section > div button small", { gridColumn: 2, fontSize: "5px" });
globalStyle(".section-sql .dwim-column-browser .dwim-column-menu section > div", { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" });
globalStyle(".section-sql .dwim-column-browser .dwim-column-menu section > div button", { minHeight: "31px", gridTemplateColumns: "16px minmax(0, 1fr) auto", alignItems: "center", padding: "6px 7px" });
globalStyle(".section-sql .dwim-column-browser .dwim-column-menu section > div button small", { gridColumn: 3, color: vars.color.muted, fontFamily: "ui-monospace, monospace", fontSize: "5.5px" });
globalStyle(".dwim-column-menu section > div > p, .dwim-column-empty", { gridColumn: "1 / -1", margin: 0, padding: "10px 8px", color: vars.color.muted, fontSize: "7px" });
globalStyle(".section-sql .dwim-column-menu", { top: "auto", right: "auto", bottom: "calc(100% + 5px)", left: 0 });

globalStyle(".monaco-editor .monaco-direct-token", { margin: "0 1px", padding: "1px 2px", borderBottom: `1px solid ${vars.color.tealDark}`, borderRadius: "2px 2px 0 0", background: "rgb(221 245 242 / 75%)", cursor: "pointer" });
globalStyle(".monaco-editor .monaco-direct-token.source", { borderBottomColor: vars.color.amethyst, background: "rgb(236 233 248 / 78%)" });
globalStyle(".monaco-editor .monaco-direct-caret", { color: vars.color.tealDark, fontSize: "9px", cursor: "pointer" });
// Monaco's stock light SQL theme uses pure red for strings, which misses WCAG
// contrast at the editor's default size. Keep the syntax role while bringing
// it into the darker Chartize watermelon range.
globalStyle(".monaco-editor.vs .mtk4", { color: "#b4233f !important" });
globalStyle(".inline-query-layer", { position: "fixed", inset: 0, zIndex: vars.layer.floatingControl, overflow: "visible", pointerEvents: "none" });
globalStyle(".inline-query-control", { position: "absolute", left: "var(--inline-left)", top: "var(--inline-top)", transform: "translateY(-50%)", pointerEvents: "auto" });
globalStyle(".inline-query-control .dwim-column-picker", { width: "18px", height: "18px" });
globalStyle(".inline-query-control .dwim-column-picker > summary, .inline-source-control > summary", { width: "18px", height: "18px", borderRadius: "50%", fontSize: "13px", boxShadow: "0 2px 7px rgb(10 15 13 / 15%)" });
globalStyle(".inline-select-control .dwim-column-menu", { right: "auto", left: 0 });
globalStyle(".inline-source-control", { width: "18px", height: "18px" });
globalStyle(".inline-source-menu", { position: "absolute", top: "calc(100% + 5px)", left: 0, zIndex: vars.layer.popover, width: "min(540px, calc(100vw - 42px))", maxHeight: "300px", overflow: "auto", padding: 0, border: `1px solid ${vars.color.strongLine}`, borderTop: `4px solid ${vars.color.teal}`, borderRadius: "2px", background: vars.color.panel, boxShadow: "0 16px 42px rgb(10 15 13 / 20%)" });
globalStyle(".inline-source-menu > header", { minHeight: "38px", display: "grid", gridTemplateColumns: "34px minmax(0, 1fr) auto", alignItems: "stretch", margin: 0, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".inline-source-menu > header::before", { content: "\"01\"", display: "grid", placeItems: "center", background: vars.color.ink, color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "7px" });
globalStyle(".inline-source-menu > header b", { alignSelf: "center", paddingLeft: "8px", fontSize: "17px", fontWeight: 300 });
globalStyle(".inline-source-menu > header span", { alignSelf: "center", paddingRight: "8px", color: vars.color.muted, fontSize: "7px" });
globalStyle(".inline-source-menu > header + .dwim-source-tiles, .source-dock-add > div > header + .dwim-source-tiles", { borderTop: 0 });

globalStyle(".result-card", { gridTemplateRows: "39px minmax(0, 1fr) auto" });
globalStyle(".compact-workspace-tabs, .compact-chart-ai-entry", { display: "none" });
globalStyle(".result-toolbar", { minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "stretch", background: vars.color.canvas, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".result-toolbar .result-tabs", { borderBottom: 0 });
globalStyle(".result-toolbar .chart-header-tools", { padding: "3px 8px 3px 0" });
globalStyle(".chart-result-view", { position: "relative", width: "100%", height: "100%", minWidth: 0, minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", overflow: "hidden" });
globalStyle(".chart-result-view.blank", { gridTemplateRows: "minmax(0, 1fr)" });
globalStyle(".blank-chart-grid", {
  width: "100%",
  height: "100%",
  minWidth: 0,
  minHeight: 0,
  backgroundColor: vars.color.panel,
  backgroundImage: `linear-gradient(${vars.color.line} 1px, transparent 1px), linear-gradient(90deg, ${vars.color.line} 1px, transparent 1px)`,
  backgroundPosition: "-1px -1px",
  backgroundSize: "28px 28px",
});
globalStyle(".chart-result-view .chart-header", { minHeight: "80px", display: "block" });
globalStyle(".chart-result-view .chart-view-shell", { minHeight: 0 });
globalStyle(".table-stream-sentinel", { width: "100%", height: "1px" });
globalStyle(".table-stream-status", { minHeight: "29px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "4px 8px", background: vars.color.canvas, borderTop: `1px solid ${vars.color.line}`, color: vars.color.muted, fontSize: "7px" });
globalStyle(".table-stream-progress", { display: "flex", alignItems: "center", gap: "5px" });
globalStyle(".table-stream-progress .spinner", { width: "11px", height: "11px", borderWidth: "1.5px" });
globalStyle(".result-context-ai", { width: "auto", margin: "7px 9px" });

/* One conversation, scoped to the pane opposite the object being discussed. */
globalStyle(".ai-overlay.placement-left", { inset: "0 auto 0 0", width: "clamp(460px, var(--ai-left-width, 44vw), calc(100vw - 460px))", "@media": { "screen and (max-width: 960px)": { width: "clamp(440px, var(--ai-left-width, 48vw), calc(100vw - 440px))" }, "screen and (max-width: 680px)": { width: "440px" } } });
globalStyle(".ai-overlay.placement-right", { inset: "0 0 0 var(--ai-left-width, 44vw)", width: "auto", "@media": { "screen and (max-width: 960px)": { left: "var(--ai-left-width, 48vw)" }, "screen and (max-width: 680px)": { left: "440px" } } });
globalStyle(".ai-overlay.placement-left .ai-surface", { width: "100%" });
globalStyle(".ai-overlay.placement-right .ai-surface", { width: "min(640px, 100%)", margin: "0 auto 0 0", paddingRight: "26px", paddingLeft: "30px" });
globalStyle("::view-transition-old(chartize-ai-entry), ::view-transition-new(chartize-ai-entry)", { animationDuration: "380ms", animationTimingFunction: "cubic-bezier(.2,.8,.2,1)" });
globalStyle(".ai-overlay::before, .ai-surface, .toolbar-ai-button::before, ::view-transition-old(chartize-ai-entry), ::view-transition-new(chartize-ai-entry)", { "@media": { "(prefers-reduced-motion: reduce)": { animation: "none" } } });

/* Graph-first compact workspace for touch-sized and tablet viewports. */
globalStyle(".workbench-grid.dwim-layout", { "@media": { "screen and (max-width: 1100px)": { minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)", gridTemplateRows: "41px minmax(0, 1fr)" } } });
globalStyle(".compact-workspace-tabs", { "@media": { "screen and (max-width: 1100px)": { position: "relative", zIndex: vars.layer.chrome, gridColumn: 1, gridRow: 1, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", background: vars.color.canvas, borderBottom: `1px solid ${vars.color.strongLine}` } } });
globalStyle(".compact-workspace-tabs button", { "@media": { "screen and (max-width: 1100px)": { minWidth: 0, display: "grid", gridTemplateColumns: "30px minmax(0, 1fr)", alignItems: "stretch", padding: 0, border: 0, borderRight: `1px solid ${vars.color.line}`, borderBottom: "3px solid transparent", background: "transparent", color: vars.color.muted, cursor: "pointer", textAlign: "left" } } });
globalStyle(".compact-workspace-tabs button:last-child", { "@media": { "screen and (max-width: 1100px)": { borderRight: 0 } } });
globalStyle(".compact-workspace-tabs button > span", { "@media": { "screen and (max-width: 1100px)": { display: "grid", placeItems: "center", color: vars.color.muted, fontFamily: "ui-monospace, monospace", fontSize: "7px" } } });
globalStyle(".compact-workspace-tabs button > b", { "@media": { "screen and (max-width: 1100px)": { alignSelf: "center", overflow: "hidden", padding: "0 9px", fontSize: "11px", fontWeight: 390, letterSpacing: "-.025em", textOverflow: "ellipsis", textTransform: "lowercase", whiteSpace: "nowrap" } } });
globalStyle(".compact-workspace-tabs button.active", { "@media": { "screen and (max-width: 1100px)": { borderBottomColor: vars.color.tealDark, background: vars.color.panel, color: vars.color.ink } } });
globalStyle(".compact-workspace-tabs button.active > span", { "@media": { "screen and (max-width: 1100px)": { background: vars.color.tealDark, color: vars.color.panel } } });

globalStyle(".workbench-grid.dwim-layout > .editor-workspace, .workbench-grid.dwim-layout > .preview-stage", { "@media": { "screen and (max-width: 1100px)": { minWidth: 0, minHeight: 0, gridColumn: 1, gridRow: 2 } } });
globalStyle(".workbench-grid.dwim-layout > .panel-resizer", { "@media": { "screen and (max-width: 1100px)": { display: "none" } } });
globalStyle(".workspace-pane-chart > .editor-workspace, .workspace-pane-code > .preview-stage, .workspace-pane-data > .preview-stage", { "@media": { "screen and (max-width: 1100px)": { display: "none" } } });
globalStyle(".workspace-pane-chart > .preview-stage, .workspace-pane-code > .editor-workspace, .workspace-pane-data > .editor-workspace", { "@media": { "screen and (max-width: 1100px)": { display: "block" } } });
globalStyle(".editor-workspace", { "@media": { "screen and (max-width: 1100px)": { borderRight: 0 } } });
globalStyle(".editor-stack", { "@media": { "screen and (max-width: 1100px)": { display: "block", height: "100%" } } });
globalStyle(".workspace-pane-code .editor-stack > .source-dock, .workspace-pane-data .editor-stack > .code-pane, .editor-stack > .panel-resizer", { "@media": { "screen and (max-width: 1100px)": { display: "none" } } });
globalStyle(".workspace-pane-code .editor-stack > .code-pane, .workspace-pane-data .editor-stack > .source-dock", { "@media": { "screen and (max-width: 1100px)": { width: "100%", height: "100%", display: "grid" } } });

globalStyle(".result-card", { "@media": { "screen and (max-width: 1100px)": { gridTemplateRows: "39px minmax(0, 1fr) auto auto" } } });
globalStyle(".compact-chart-ai-entry", { "@media": { "screen and (max-width: 1100px)": { minWidth: 0, minHeight: "46px", display: "grid", gridTemplateColumns: "24px minmax(0, 1fr) auto", alignItems: "center", gap: "7px", margin: "7px 8px", padding: "5px 8px", border: `1px solid ${vars.color.line}`, borderLeft: `3px solid ${vars.color.teal}`, borderRadius: "2px", background: "rgb(231 237 235 / 52%)", color: vars.color.muted, cursor: "text", boxShadow: "inset 3px 3px 10px rgb(42 30 92 / 8%), inset -3px -3px 10px rgb(255 255 255 / 84%)" } } });
globalStyle(".compact-chart-ai-entry:focus-within", { "@media": { "screen and (max-width: 1100px)": { borderColor: vars.color.tealDark, background: vars.color.tealPale, boxShadow: "inset 3px 3px 10px rgb(42 30 92 / 6%), 0 0 0 1px rgb(60 187 177 / 18%)" } } });
globalStyle(".compact-chart-ai-entry > span", { "@media": { "screen and (max-width: 1100px)": { color: vars.color.tealDark, fontSize: "14px", textAlign: "center" } } });
globalStyle(".compact-chart-ai-entry input", { "@media": { "screen and (max-width: 1100px)": { width: "100%", minWidth: 0, padding: "6px 2px", border: 0, outline: 0, background: "transparent", color: vars.color.ink, cursor: "text", fontSize: "10px", fontWeight: 520 } } });
globalStyle(".compact-chart-ai-entry input::placeholder", { "@media": { "screen and (max-width: 1100px)": { color: vars.color.muted, opacity: 1 } } });
globalStyle(".compact-chart-ai-entry > b", { "@media": { "screen and (max-width: 1100px)": { color: vars.color.tealDark, fontSize: "8px", fontWeight: 560, textTransform: "lowercase" } } });

globalStyle(".ai-overlay.placement-left, .ai-overlay.placement-right", { "@media": { "screen and (max-width: 1100px)": { inset: 0, width: "100%" } } });
globalStyle(".ai-overlay.placement-left .ai-surface, .ai-overlay.placement-right .ai-surface", { "@media": { "screen and (max-width: 1100px)": { width: "min(720px, 100%)", margin: "0 auto", padding: "46px clamp(14px, 4vw, 32px) 14px" } } });

globalStyle(".brand > span:last-child, .topbar-button-label", { "@media": { "screen and (max-width: 680px)": { display: "none" } } });
globalStyle(".topbar", { "@media": { "screen and (max-width: 680px)": { gridTemplateColumns: "auto minmax(0, 1fr) auto", gap: "4px", padding: "0 6px" } } });
globalStyle(".brand", { "@media": { "screen and (max-width: 680px)": { gap: 0 } } });
globalStyle(".topbar-workspace-lockup", { "@media": { "screen and (max-width: 680px)": { width: "100%", gap: "3px", overflow: "hidden" } } });
globalStyle(".workspace-switcher", { "@media": { "screen and (max-width: 680px)": { minWidth: 0, flex: "1 1 auto" } } });
globalStyle(".workspace-switcher > summary", { "@media": { "screen and (max-width: 680px)": { width: "100%", maxWidth: "none" } } });
globalStyle(".new-visualization-button, .example-picker > summary, .toolbar-ai-button", { "@media": { "screen and (max-width: 680px)": { width: "29px", minWidth: "29px", padding: 0 } } });
globalStyle(".toolbar-ai-button", { "@media": { "screen and (max-width: 680px)": { justifyContent: "center" } } });
globalStyle(".preview-stage", { "@media": { "screen and (max-width: 680px)": { padding: 0 } } });
globalStyle(".chart-card", { "@media": { "screen and (max-width: 680px)": { border: 0 } } });
globalStyle(".chart-result-view .chart-header", { "@media": { "screen and (max-width: 680px)": { minHeight: "68px", padding: "10px 12px 12px" } } });
globalStyle(".chart-title h1", { "@media": { "screen and (max-width: 680px)": { fontSize: "clamp(23px, 8vw, 34px)" } } });
globalStyle(".chart-view", { "@media": { "screen and (max-width: 680px)": { padding: "6px" } } });

/* Explicit chart exploration: selection zoom, step back, and fit all. */
globalStyle(".chart-explore-controls", { position: "absolute", top: "10px", right: "12px", zIndex: vars.layer.floatingControl, display: "grid", overflow: "hidden", border: `1px solid ${vars.color.strongLine}`, borderRadius: "2px", background: "rgb(255 255 255 / 90%)", boxShadow: "0 5px 16px rgb(10 15 13 / 11%)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" });
globalStyle(".chart-explore-controls button", { width: "30px", height: "30px", display: "grid", placeItems: "center", padding: 0, border: 0, borderBottom: `1px solid ${vars.color.line}`, borderRadius: 0, background: "transparent", color: vars.color.tealDark, cursor: "pointer" });
globalStyle(".chart-explore-controls button:nth-child(2)", { color: vars.color.amethyst });
globalStyle(".chart-explore-controls button:last-child", { borderBottom: 0, color: vars.color.muted });
globalStyle(".chart-explore-controls button:hover:not(:disabled)", { background: vars.color.tealPale });
globalStyle(".chart-explore-controls button:disabled", { opacity: .28, cursor: "not-allowed" });
globalStyle(".chart-explore-controls svg", { width: "17px", height: "17px", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" });
globalStyle(".chart-explore-controls.graph-controls", { gridTemplateColumns: "30px" });
globalStyle(".chart-explore-controls.map-controls", { right: "auto", left: "12px", width: "110px", gap: "7px", overflow: "visible", padding: "7px", borderColor: `color-mix(in srgb, ${vars.color.tealDark} 55%, ${vars.color.line})`, background: "rgb(255 255 255 / 88%)" });
globalStyle(".map-compass", { width: "82px", height: "82px", justifySelf: "center", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(3, 1fr)", padding: "4px", border: `1px solid ${vars.color.strongLine}`, borderRadius: "50%", background: vars.color.canvas, boxShadow: "inset 0 0 0 4px rgb(60 187 177 / 7%)" });
globalStyle(".chart-explore-controls .map-compass button", { width: "100%", height: "100%", border: 0, color: vars.color.tealDark, fontSize: "14px", lineHeight: 1 });
globalStyle(".map-compass .north", { gridColumn: 2, gridRow: 1 });
globalStyle(".map-compass .west", { gridColumn: 1, gridRow: 2 });
globalStyle(".map-compass .home", { gridColumn: 2, gridRow: 2, position: "relative", display: "grid", placeItems: "center", color: vars.color.amethyst });
globalStyle(".map-compass .home span", { position: "absolute", top: "-16px", fontSize: "6px", fontWeight: 750, letterSpacing: ".08em" });
globalStyle(".map-compass .home i", { width: "7px", height: "7px", border: `1px solid ${vars.color.amethyst}`, borderRadius: "50%", background: vars.color.panel });
globalStyle(".map-compass .east", { gridColumn: 3, gridRow: 2 });
globalStyle(".map-compass .south", { gridColumn: 2, gridRow: 3 });
globalStyle(".map-zoom", { display: "grid", gridTemplateColumns: "28px minmax(0, 1fr) 28px", alignItems: "center", borderTop: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".chart-explore-controls .map-zoom button", { width: "28px", height: "26px", border: 0, color: vars.color.tealDark, fontSize: "17px" });
globalStyle(".map-zoom span", { color: vars.color.muted, fontSize: "7px", textAlign: "center", fontVariantNumeric: "tabular-nums" });
globalStyle(".map-controls small", { color: vars.color.muted, fontSize: "6px", lineHeight: 1.25, textAlign: "center" });
globalStyle(".map-interaction", { cursor: "grab" });
globalStyle(".map-interaction.is-panning", { cursor: "grabbing" });
globalStyle(".map-interaction .chart-embed", { willChange: "transform" });
globalStyle(".map-feature-pin", { position: "absolute", zIndex: vars.layer.popover, width: "14px", height: "14px", overflow: "visible", border: "3px solid white", borderRadius: "50%", background: vars.color.tealDark, boxShadow: "0 2px 10px rgb(10 15 13 / 35%)", transform: "translate(-50%, -50%)", pointerEvents: "none" });
globalStyle(".visual-item-label", { position: "absolute", left: "14px", top: "-6px", minWidth: "96px", maxWidth: "210px", display: "grid", gap: "1px", padding: "4px 6px", border: `1px solid ${vars.color.strongLine}`, borderLeft: `3px solid ${vars.color.teal}`, borderRadius: "1px", background: "rgb(255 255 255 / 92%)", boxShadow: "0 6px 16px rgb(10 15 13 / 16%)", color: vars.color.ink, textAlign: "left", transform: "none" });
globalStyle(".visual-item-label.to-left", { left: "auto", right: "14px", borderLeft: `1px solid ${vars.color.strongLine}`, borderRight: `3px solid ${vars.color.teal}` });
globalStyle(".visual-item-label b", { overflow: "hidden", fontSize: "8px", fontWeight: 620, lineHeight: 1.2, textOverflow: "ellipsis", textTransform: "lowercase", whiteSpace: "nowrap" });
globalStyle(".visual-item-label small", { overflow: "hidden", color: vars.color.muted, fontFamily: "ui-monospace, monospace", fontSize: "6px", lineHeight: 1.25, textOverflow: "ellipsis", whiteSpace: "nowrap" });
/* The active cursor/selection is visible inside the single AI transcript. */
globalStyle(".ai-active-context", { minHeight: "44px", display: "grid", gridTemplateColumns: "31px minmax(0, 1fr)", alignItems: "stretch", gap: 0, margin: 0, padding: 0, border: `1px solid ${vars.color.strongLine}`, borderBottom: 0, color: vars.color.muted, background: "rgb(255 255 255 / 48%)", fontSize: "8px", lineHeight: 1.45, animation: "ai-context-arrive 240ms cubic-bezier(.2,.75,.2,1) both" });
globalStyle(".ai-context-index", { display: "grid", placeItems: "center", background: vars.color.ink, color: vars.color.panel, fontFamily: "ui-monospace, monospace", fontSize: "7px" });
globalStyle(".ai-active-context > div", { minWidth: 0, display: "grid", alignContent: "center", gap: "2px", padding: "7px 10px 8px" });
globalStyle(".ai-active-context b", { color: vars.color.tealDark, fontSize: "7px", fontWeight: 560, letterSpacing: ".04em", textTransform: "lowercase" });
