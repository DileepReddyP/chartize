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
});

const systemFont = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

globalStyle("*", { boxSizing: "border-box" });
globalStyle("html, body", { width: "100%", height: "100%", margin: 0, overflow: "hidden" });
globalStyle("body", { background: vars.color.canvas, color: vars.color.ink, fontFamily: systemFont, fontSize: "14px" });
globalStyle("button, input, select, textarea", { font: "inherit" });
globalStyle("button, a, summary", { WebkitTapHighlightColor: "transparent" });
globalStyle("a", { color: "inherit" });
globalStyle("button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, summary:focus-visible", { outline: `3px solid ${vars.color.teal}`, outlineOffset: "2px" });
globalStyle("button:disabled", { cursor: "not-allowed", opacity: 0.48 });

globalStyle(".topbar", {
  height: "40px",
  display: "grid",
  gridTemplateColumns: "1fr auto",
  alignItems: "center",
  gap: "20px",
  padding: "0 14px",
  background: vars.color.panel,
  borderBottom: `1px solid ${vars.color.line}`,
});
globalStyle(".brand", { display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", fontSize: "17px", fontWeight: 650, letterSpacing: "-.04em", textTransform: "lowercase" });
globalStyle(".brand-mark", { width: "15px", height: "15px", background: vars.color.teal, borderRadius: "50%" });
globalStyle(".topbar nav", { justifySelf: "end", display: "flex", alignItems: "center", gap: "18px" });
globalStyle(".topbar nav a", { color: vars.color.muted, textDecoration: "none", fontSize: "11px", fontWeight: 700, textTransform: "lowercase" });
globalStyle(".topbar nav a:hover", { color: vars.color.tealDark });
globalStyle(".toolbar-ai-button", { position: "relative", zIndex: 0, minHeight: "27px", display: "flex", alignItems: "center", gap: "5px", padding: "4px 9px", overflow: "hidden", border: 0, borderRadius: "4px", background: "transparent", color: vars.color.amethyst, cursor: "pointer", isolation: "isolate", fontSize: "10px", fontWeight: 650, textTransform: "lowercase", "@media": { "screen and (max-width: 680px)": { padding: "4px 6px", fontSize: "9px" } } });
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
globalStyle(".toolbar-ai-button::before", { content: "", position: "absolute", left: "50%", top: "50%", zIndex: -2, width: "220%", aspectRatio: "1", background: `conic-gradient(from 0turn, transparent 0 62%, rgb(60 187 177 / 22%) 70%, ${vars.color.teal} 82%, ${vars.color.tealDark} 90%, transparent 100%)`, animation: "ai-border-orbit 2.2s linear infinite", pointerEvents: "none" });
globalStyle(".toolbar-ai-button::after", { content: "", position: "absolute", inset: "1px", zIndex: -1, borderRadius: "inherit", background: vars.color.panel, pointerEvents: "none" });
globalStyle(".toolbar-ai-button:hover::after", { background: vars.color.tealPale });
globalStyle(".run-button", { minWidth: "80px", minHeight: "31px", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", border: 0, borderRadius: "2px", background: vars.color.teal, color: vars.color.ink, cursor: "pointer", fontSize: "10px", fontWeight: 800, textTransform: "lowercase" });
globalStyle(".run-button:hover", { background: vars.color.tealDark, color: vars.color.panel });
globalStyle(".run-button > span", { fontSize: "8px" });
globalStyle(".code-error", { flex: "0 0 auto" });
globalStyle(".code-error summary", { width: "27px", height: "27px", display: "grid", placeItems: "center", border: 0, borderRadius: "50%", background: "transparent", color: vars.color.watermelon, cursor: "pointer", listStyle: "none", fontSize: "19px", fontWeight: 800 });
globalStyle(".code-error summary::-webkit-details-marker", { display: "none" });
globalStyle(".code-error summary:hover, .code-error[open] summary", { boxShadow: `inset 0 0 0 1px ${vars.color.watermelon}`, background: "rgb(238 66 102 / 8%)" });
globalStyle(".code-error > div", { position: "absolute", top: "calc(100% + 1px)", right: "12px", left: "12px", zIndex: 40, width: "auto", minWidth: 0, padding: "11px 12px", borderLeft: `4px solid ${vars.color.watermelon}`, background: "rgb(255 245 247 / 98%)", color: vars.color.ink, boxShadow: "0 12px 32px rgb(10 15 13 / 16%)" });
globalStyle(".code-error > div strong", { color: vars.color.watermelon, fontSize: "9px", letterSpacing: ".04em", textTransform: "lowercase" });
globalStyle(".code-error > div p", { margin: "5px 0 0", fontSize: "9px", lineHeight: 1.45 });

globalStyle(".pane-empty", { height: "100%", display: "grid", placeContent: "center", gap: "5px", padding: "24px", color: vars.color.muted, textAlign: "center", fontSize: "11px" });
globalStyle(".pane-empty strong", { color: vars.color.ink, fontSize: "16px", fontWeight: 350, textTransform: "lowercase" });
globalStyle(".pane-empty span", { display: "block" });

globalStyle(".preview-stage", { position: "relative", minWidth: 0, minHeight: 0, overflow: "hidden", padding: "10px", background: vars.color.canvas });
globalStyle(".chart-card", { position: "relative", width: "100%", height: "100%", minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(0, 1fr) auto", overflow: "hidden", background: vars.color.panel, border: `1px solid ${vars.color.line}`, borderRadius: "2px" });
globalStyle(".chart-header", { minHeight: "82px", display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "start", gap: "13px", padding: "11px 13px", borderBottom: `1px solid ${vars.color.line}` });
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
globalStyle(".preview-menu > div", { position: "absolute", top: "calc(100% + 5px)", right: 0, zIndex: 12, width: "195px", display: "grid", padding: "5px", background: vars.color.panel, border: `1px solid ${vars.color.strongLine}`, borderRadius: "2px", boxShadow: "0 10px 30px rgb(10 15 13 / 14%)" });
globalStyle(".preview-menu > div > span", { padding: "5px 9px 3px", color: vars.color.muted, fontSize: "8px", fontWeight: 750, letterSpacing: ".04em", textTransform: "lowercase" });
globalStyle(".preview-menu > div button", { padding: "8px 9px", border: 0, borderRadius: "2px", background: "transparent", color: vars.color.ink, textAlign: "left", cursor: "pointer", fontSize: "10px", fontWeight: 650, textTransform: "lowercase" });
globalStyle(".preview-menu > div button:hover", { background: vars.color.tealPale });
globalStyle(".chart-title", { minWidth: 0 });
globalStyle(".chart-title h1", { margin: 0, fontSize: "clamp(25px, 3vw, 46px)", fontWeight: 300, lineHeight: ".98", letterSpacing: "-.06em", textTransform: "lowercase" });
globalStyle(".chart-title p", { maxWidth: "760px", margin: "6px 0 0", color: vars.color.muted, fontSize: "10px", lineHeight: 1.4 });
globalStyle(".chart-label-text", { maxWidth: "100%", display: "block", overflow: "hidden", padding: 0, border: 0, borderRadius: 0, background: "transparent", color: "inherit", font: "inherit", fontWeight: "inherit", lineHeight: "inherit", letterSpacing: "inherit", textAlign: "left", textOverflow: "ellipsis", textTransform: "inherit", whiteSpace: "normal", cursor: "text" });
globalStyle(".chart-label-input", { width: "min(100%, 980px)", padding: "1px 4px", border: 0, borderBottom: `2px solid ${vars.color.teal}`, borderRadius: 0, outline: 0, background: vars.color.tealPale, color: "inherit", font: "inherit", fontWeight: "inherit", lineHeight: "inherit", letterSpacing: "inherit", textTransform: "inherit" });
globalStyle(".chart-title p.empty", { opacity: .4 });
globalStyle(".chart-status", { flex: "0 0 auto", marginRight: "5px", padding: "4px 7px", borderRadius: "2px", background: vars.color.canvas, color: vars.color.muted, fontFamily: "ui-monospace, monospace", fontSize: "8px" });
globalStyle(".chart-status.running", { background: vars.color.tealPale, color: vars.color.tealDark });
globalStyle(".chart-view-shell", { position: "relative", minWidth: 0, minHeight: 0, overflow: "hidden" });
globalStyle(".chart-view", { width: "100%", height: "100%", minWidth: 0, minHeight: 0, display: "block", overflow: "auto", padding: "10px", overscrollBehavior: "contain" });
globalStyle(".chart-view > div, .chart-view .vega-embed", { width: "100%", height: "100%", maxWidth: "100%" });
globalStyle(".pane-loading-mask", { position: "absolute", inset: 0, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "rgb(244 247 246 / 48%)", color: vars.color.tealDark, backdropFilter: "blur(11px) saturate(.9)", WebkitBackdropFilter: "blur(11px) saturate(.9)", fontSize: "9px", fontWeight: 700, letterSpacing: ".02em", textTransform: "lowercase" });
globalStyle(".pane-loading-mask .spinner", { width: "20px", height: "20px", background: "rgb(255 255 255 / 48%)", boxShadow: "0 4px 16px rgb(10 15 13 / 9%)" });
globalStyle(".empty-chart", { width: "100%", height: "100%", display: "grid", placeItems: "center", padding: "24px", color: vars.color.muted, textAlign: "center" });
globalStyle(".empty-chart b", { display: "block", marginBottom: "5px", color: vars.color.ink, fontSize: "22px", fontWeight: 300, textTransform: "lowercase" });
globalStyle(".chart-footer", { display: "flex", justifyContent: "space-between", gap: "10px", minWidth: 0, padding: "4px 8px", background: vars.color.canvas, borderTop: `1px solid ${vars.color.line}`, color: vars.color.muted, fontSize: "7px" });
globalStyle(".chart-footer span", { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".status-dot", { display: "inline-block", width: "6px", height: "6px", marginRight: "3px", borderRadius: "50%", background: vars.color.strongLine });
globalStyle(".status-dot.ready", { background: vars.color.tealDark });
globalStyle(".status-dot.error", { background: vars.color.watermelon });
globalStyle(".status-toast", { position: "absolute", left: "12px", bottom: "36px", zIndex: 8, maxWidth: "420px", padding: "8px 10px", border: 0, borderRadius: "2px", background: vars.color.tealPale, color: vars.color.tealDark, cursor: "pointer", textAlign: "left", fontSize: "9px" });

globalStyle(".primary-button, .ghost-button", { minHeight: "31px", padding: "6px 10px", border: `1px solid ${vars.color.line}`, borderRadius: "2px", background: vars.color.panel, color: vars.color.ink, cursor: "pointer", fontSize: "10px", fontWeight: 750, textTransform: "lowercase" });
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
globalStyle(".ai-overlay", { position: "fixed", top: 0, bottom: 0, zIndex: 100, minWidth: 0, minHeight: 0, overflow: "hidden", isolation: "isolate" });
globalStyle(".ai-overlay.context-code", { right: 0, left: "max(390px, 34vw)" });
globalStyle(".ai-overlay.context-chart, .ai-overlay.context-general", { left: 0, width: "max(390px, 34vw)" });
globalStyle(".ai-overlay::before", { content: "", position: "absolute", inset: 0, zIndex: -1, background: "rgb(244 247 246 / 68%)", backdropFilter: "blur(22px) saturate(1.14)", WebkitBackdropFilter: "blur(22px) saturate(1.14)", animation: "ai-blur-in 360ms cubic-bezier(.2,.75,.2,1) both" });
globalStyle(".ai-overlay.context-code::before", { background: "rgb(244 247 246 / 70%)", maskImage: "none", WebkitMaskImage: "none" });
globalStyle(".ai-overlay.context-chart::before, .ai-overlay.context-general::before", { background: "rgb(244 247 246 / 70%)", maskImage: "none", WebkitMaskImage: "none" });
globalStyle(".ai-surface", { width: "100%", height: "100%", minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(100px, 1fr) auto", gap: "8px", overflow: "hidden", padding: "48px 18px 12px", background: "transparent", border: 0, animation: "ai-surface-in 300ms cubic-bezier(.2,.75,.2,1) both" });
globalStyle(".context-code .ai-surface", { width: "min(570px, 100%)", marginRight: "auto", marginLeft: 0, paddingRight: "24px", paddingLeft: "32px" });
globalStyle(".ai-surface-header", { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" });
globalStyle(".ai-surface-header > div", { minWidth: 0, display: "flex", alignItems: "baseline", gap: "7px" });
globalStyle(".ai-surface-header h2", { margin: 0, fontSize: "30px", fontWeight: 300, lineHeight: 1, letterSpacing: "-.055em", textTransform: "lowercase" });
globalStyle(".ai-surface-header small", { color: vars.color.muted, fontSize: "8px", fontWeight: 650, textTransform: "lowercase" });
globalStyle(".ai-spark", { color: vars.color.tealDark, fontSize: "17px" });
globalStyle(".ai-surface-header > button", { width: "38px", height: "38px", display: "grid", placeItems: "center", flex: "0 0 auto", padding: "0 0 3px", border: "1px solid rgb(255 255 255 / 66%)", borderRadius: "50%", background: "rgb(196 203 202 / 38%)", color: vars.color.muted, cursor: "pointer", fontSize: "27px", fontWeight: 300, lineHeight: 1, boxShadow: "inset 3px 3px 8px rgb(89 102 98 / 18%), inset -3px -3px 8px rgb(255 255 255 / 72%)" });
globalStyle(".ai-surface-header > button:hover", { transform: "scale(1.06)", color: vars.color.ink, background: "rgb(196 203 202 / 52%)" });
globalStyle(".ai-conversation", { minHeight: 0, overflow: "auto", overscrollBehavior: "contain", padding: "4px 3px 0" });
globalStyle(".conversation-preview-label", { margin: "1px 3px 11px", color: vars.color.muted, fontSize: "8px", fontWeight: 700, letterSpacing: ".04em", textTransform: "lowercase" });
globalStyle(".ai-conversation article", { width: "100%", maxWidth: "100%", margin: "0 0 8px", padding: "9px 4px 10px 13px", border: 0, borderLeft: `2px solid ${vars.color.teal}`, borderRadius: 0, background: "transparent", boxShadow: "none", backdropFilter: "none", WebkitBackdropFilter: "none", fontSize: "11px", lineHeight: 1.48 });
globalStyle(".ai-conversation article.user", { marginLeft: 0, border: 0, borderLeft: `2px solid ${vars.color.amethyst}`, borderRadius: 0, background: "transparent", boxShadow: "none" });
globalStyle(".ai-conversation article b", { display: "block", marginBottom: "5px", color: vars.color.muted, fontSize: "7px", letterSpacing: ".06em", textTransform: "lowercase" });
globalStyle(".ai-conversation article p", { maxWidth: "52ch", margin: 0, fontSize: "11px", lineHeight: 1.55 });
globalStyle(".ai-thinking", { color: vars.color.amethyst, fontSize: "9px" });
globalStyle(".ai-compose-area", { display: "grid", gap: "7px" });
globalStyle(".ai-composer", { padding: "9px 10px 8px", overflow: "hidden", border: "1px solid rgb(255 255 255 / 58%)", borderRadius: "5px", background: "rgb(231 237 235 / 46%)", boxShadow: "inset 5px 5px 16px rgb(42 30 92 / 12%), inset -5px -5px 15px rgb(255 255 255 / 84%), 0 10px 32px rgb(10 15 13 / 7%)", backdropFilter: "blur(20px) saturate(1.18)", WebkitBackdropFilter: "blur(20px) saturate(1.18)", viewTransitionName: "chartize-ai-entry" });
globalStyle(".ai-composer:focus-within", { boxShadow: "inset 4px 4px 15px rgb(42 30 92 / 14%), inset -5px -5px 15px rgb(255 255 255 / 90%), 0 0 0 2px rgb(60 187 177 / 45%), 0 12px 34px rgb(10 15 13 / 8%)" });
globalStyle(".ai-composer textarea", { width: "100%", minHeight: "52px", resize: "none", padding: 0, border: 0, outline: 0, background: "transparent", color: vars.color.ink, fontSize: "11px", lineHeight: 1.45 });
globalStyle(".ai-composer textarea:focus-visible", { outline: 0 });
globalStyle(".ai-composer-footer", { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "6px 9px", marginTop: "7px" });
globalStyle(".ai-composer-tools", { minWidth: 0, display: "flex", flex: "1 1 250px", flexWrap: "wrap", alignItems: "center", gap: "5px" });
globalStyle(".ai-send-cluster", { display: "flex", flex: "0 0 auto", alignItems: "center", gap: "6px", marginLeft: "auto" });
globalStyle(".ai-send-cluster > span", { color: vars.color.muted, fontSize: "8px" });
globalStyle(".ai-send-button", { minHeight: "30px", display: "flex", alignItems: "center", gap: "5px", padding: "5px 10px", border: 0, borderRadius: "3px", background: vars.color.amethyst, color: vars.color.panel, cursor: "pointer", fontSize: "9px", fontWeight: 700, textTransform: "lowercase", boxShadow: "0 5px 15px rgb(42 30 92 / 20%)" });
globalStyle(".ai-send-button > span", { color: vars.color.teal });
globalStyle(".ai-actions", { display: "flex", flexWrap: "wrap", gap: "5px" });
globalStyle(".ai-actions > button", { minHeight: "25px", padding: "4px 7px", border: "1px solid rgb(255 255 255 / 65%)", borderRadius: "3px", background: "rgb(255 255 255 / 42%)", color: vars.color.amethyst, cursor: "pointer", fontSize: "7.5px", fontWeight: 700, textTransform: "lowercase", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" });
globalStyle(".checkbox-row", { display: "flex", alignItems: "center", gap: "6px", color: vars.color.muted, fontSize: "9px", fontWeight: 650, textTransform: "lowercase" });
globalStyle(".checkbox-row input", { margin: 0, accentColor: vars.color.tealDark });
globalStyle(".ai-status", { margin: 0, padding: "8px 10px", border: "1px solid rgb(255 255 255 / 62%)", borderRadius: "3px", background: "rgb(236 233 248 / 62%)", color: vars.color.amethyst, fontSize: "9px", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" });

globalKeyframes("spin", { to: { transform: "rotate(360deg)" } });
globalStyle(".spinner", { width: "18px", height: "18px", border: `2px solid ${vars.color.line}`, borderTopColor: vars.color.tealDark, borderRadius: "50%", animation: "spin .7s linear infinite" });
globalStyle(".loading-page", { height: "calc(100dvh - 40px)", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", overflow: "hidden", color: vars.color.muted });

globalStyle(".prose-page, .error-page, .admin-shell", { height: "calc(100dvh - 40px)", overflow: "auto", overscrollBehavior: "contain" });
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
globalStyle(".dataset-row button, .section-heading button", { padding: "6px 8px", border: `1px solid ${vars.color.line}`, borderRadius: "5px", background: vars.color.panel, cursor: "pointer", fontSize: "10px", fontWeight: 700, textTransform: "lowercase" });
globalStyle(".empty-state", { color: vars.color.muted, padding: "18px 0 5px" });

/* The workbench is a document with contextual transients, not a dashboard of permanent modes. */
globalStyle(".editor-workspace", { position: "relative", minWidth: 0, minHeight: 0, overflow: "hidden", background: vars.color.panel, borderRight: `1px solid ${vars.color.strongLine}` });
globalStyle(".editor-workspace .code-pane", { gridTemplateRows: "40px minmax(0, 1fr)" });
globalStyle(".editor-body", { position: "relative", minWidth: 0, minHeight: 0, overflow: "hidden" });
globalStyle(".editor-workspace .code-toolbar", { padding: "5px 9px 5px 14px" });
globalStyle(".editor-workspace .code-toolbar strong", { fontSize: "19px", fontWeight: 300, lineHeight: .95, letterSpacing: "-.045em", textTransform: "lowercase" });
globalStyle(".editor-workspace .code-toolbar > div > span", { marginTop: "3px", fontSize: "8px" });
globalStyle(".code-workspace-actions", { flex: "0 0 auto", display: "flex", alignItems: "center", gap: "3px" });
globalStyle(".new-visualization-button, .example-picker > summary", { minHeight: "27px", display: "flex", alignItems: "center", justifyContent: "center", gap: "3px", padding: "4px 7px", border: `1px solid ${vars.color.line}`, borderRadius: "2px", background: vars.color.panel, color: vars.color.muted, cursor: "pointer", listStyle: "none", fontSize: "8px", fontWeight: 650, textTransform: "lowercase", whiteSpace: "nowrap" });
globalStyle(".new-visualization-button", { borderColor: vars.color.teal, color: vars.color.tealDark });
globalStyle(".new-visualization-button > span", { fontSize: "12px", lineHeight: 0 });
globalStyle(".new-visualization-button:hover, .example-picker > summary:hover, .example-picker[open] > summary", { background: vars.color.tealPale, color: vars.color.tealDark });
globalStyle(".example-picker", { position: "relative" });
globalStyle(".example-picker > summary::-webkit-details-marker", { display: "none" });
globalStyle(".example-picker > div", { position: "absolute", top: "calc(100% + 7px)", right: 0, zIndex: 80, width: "min(470px, calc(100vw - 26px))", maxHeight: "min(560px, calc(100vh - 94px))", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", overflow: "auto", border: `1px solid ${vars.color.strongLine}`, borderTop: `4px solid ${vars.color.teal}`, background: vars.color.panel, boxShadow: "0 18px 48px rgb(10 15 13 / 19%)" });
globalStyle(".example-picker > div > header", { gridColumn: "1 / -1", padding: "9px 10px", borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".editor-workspace .code-toolbar .example-picker > div > header strong", { fontSize: "17px", fontWeight: 300, letterSpacing: "-.04em" });
globalStyle(".example-picker > div > button", { minWidth: 0, display: "grid", gap: "4px", padding: "10px", border: 0, borderRight: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}`, borderRadius: 0, background: vars.color.panel, color: vars.color.ink, cursor: "pointer", textAlign: "left" });
globalStyle(".example-picker > div > button:hover", { background: vars.color.tealPale });
globalStyle(".editor-workspace .code-toolbar .example-picker > div > button strong", { overflow: "hidden", fontSize: "10px", fontWeight: 620, lineHeight: 1.15, letterSpacing: "-.01em", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".example-picker > div > button span", { color: vars.color.muted, fontSize: "7px", lineHeight: 1.4 });
globalStyle(".example-picker > div > button small", { color: vars.color.tealDark, fontSize: "6px", fontWeight: 650, textTransform: "lowercase" });

globalStyle(".dwim-panel", { position: "fixed", left: "var(--dwim-left)", top: "var(--dwim-top)", zIndex: 45, width: "min(640px, calc(100vw - var(--dwim-left) - 12px))", maxHeight: "min(620px, calc(100vh - 60px))", display: "grid", gridTemplateRows: "auto auto auto minmax(0, 1fr)", overflow: "hidden", border: `1px solid ${vars.color.strongLine}`, borderTop: `4px solid ${vars.color.teal}`, borderRadius: "2px", background: "rgb(255 255 255 / 97%)", boxShadow: "0 18px 48px rgb(10 15 13 / 19%)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", "@media": { "screen and (max-width: 680px)": { width: "min(420px, calc(100% - 12px))" } } });
globalStyle(".dwim-panel.section-selection", { borderTopColor: vars.color.amethyst });
globalStyle(".dwim-heading", { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "7px 9px", borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".dwim-heading h2", { margin: 0, fontSize: "24px", fontWeight: 300, lineHeight: .95, letterSpacing: "-.055em", textTransform: "lowercase" });
globalStyle(".dwim-heading > button", { width: "26px", height: "26px", display: "grid", placeItems: "center", padding: "0 0 2px", border: 0, borderRadius: "50%", background: vars.color.canvas, color: vars.color.muted, cursor: "pointer", fontSize: "20px", fontWeight: 300 });
globalStyle(".dwim-command", { display: "grid", gridTemplateColumns: "18px minmax(0, 1fr) auto", alignItems: "center", gap: "6px", margin: "9px 10px", padding: "6px 7px", border: `1px solid ${vars.color.line}`, borderRadius: "3px", background: vars.color.canvas, boxShadow: "inset 2px 2px 7px rgb(89 102 98 / 10%)" });
globalStyle(".dwim-command > span", { color: vars.color.tealDark, textAlign: "center" });
globalStyle(".dwim-command input", { width: "100%", minWidth: 0, padding: "4px", border: 0, outline: 0, background: "transparent", color: vars.color.ink, fontSize: "10px" });
globalStyle(".dwim-command button", { minHeight: "26px", padding: "4px 8px", border: 0, borderRadius: "2px", background: vars.color.tealDark, color: vars.color.panel, cursor: "pointer", fontSize: "9px", fontWeight: 700, textTransform: "lowercase" });
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
globalStyle(".dwim-selection", { minHeight: 0, overflow: "auto", padding: "0 10px 10px" });
globalStyle(".dwim-selection pre", { maxHeight: "180px", margin: 0, overflow: "auto", padding: "9px", background: vars.color.canvas, borderLeft: `3px solid ${vars.color.amethyst}`, color: vars.color.ink, fontFamily: "ui-monospace, monospace", fontSize: "9px", lineHeight: 1.45, whiteSpace: "pre-wrap" });
globalStyle(".dwim-selection > div", { display: "flex", gap: "5px", marginTop: "7px" });
globalStyle(".dwim-selection button, .result-context-actions button", { padding: "6px 8px", border: `1px solid ${vars.color.line}`, borderRadius: "2px", background: vars.color.panel, color: vars.color.ink, cursor: "pointer", fontSize: "8px", fontWeight: 650, textTransform: "lowercase" });

globalStyle(".result-tabs", { minWidth: 0, display: "flex", alignItems: "stretch", padding: "0 11px", background: vars.color.canvas, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".result-tabs button", { display: "flex", alignItems: "flex-end", gap: "5px", padding: "0 11px 7px", border: 0, borderBottom: "3px solid transparent", background: "transparent", color: vars.color.muted, cursor: "pointer", fontSize: "12px", fontWeight: 320, letterSpacing: "-.03em", textTransform: "lowercase" });
globalStyle(".result-tabs button:first-child", { paddingLeft: 1 });
globalStyle(".result-tabs button.active", { borderBottomColor: vars.color.tealDark, color: vars.color.ink });
globalStyle(".result-tabs button span", { color: vars.color.tealDark, fontFamily: "ui-monospace, monospace", fontSize: "7px" });
globalStyle(".result-stage", { position: "relative", minWidth: 0, minHeight: 0, overflow: "hidden", background: vars.color.panel });
globalStyle(".result-stage > .chart-view-shell", { width: "100%", height: "100%" });

globalStyle(".result-table-shell", { position: "relative", width: "100%", height: "100%", minWidth: 0, minHeight: 0, display: "grid", gridTemplateRows: "minmax(0, 1fr) auto", overflow: "hidden" });
globalStyle(".result-table-scroll", { minWidth: 0, minHeight: 0, overflow: "auto", overscrollBehavior: "contain" });
globalStyle(".result-table", { minWidth: "100%", borderCollapse: "collapse", fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace", fontSize: "9px", userSelect: "none" });
globalStyle(".result-table th, .result-table td", { maxWidth: "320px", padding: "7px 9px", overflow: "hidden", borderRight: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}`, textAlign: "left", textOverflow: "ellipsis", whiteSpace: "nowrap" });
globalStyle(".result-table th", { position: "sticky", top: 0, zIndex: 3, height: "34px", padding: "4px 5px 5px 9px", background: vars.color.canvas, color: vars.color.muted, fontFamily: systemFont, fontWeight: 650 });
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
globalStyle(".chart-brush", { position: "absolute", zIndex: 8, border: `1px solid ${vars.color.amethyst}`, background: "rgb(42 30 92 / 10%)", boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 55%)", pointerEvents: "none" });
globalStyle(".chart-brush.persistent", { borderWidth: "2px", background: "rgb(42 30 92 / 8%)", boxShadow: "0 0 0 1px rgb(255 255 255 / 72%), 0 4px 14px rgb(42 30 92 / 12%)" });
globalStyle(".chart-brush-handle", { position: "absolute", width: "13px", height: "13px", padding: 0, border: "2px solid white", borderRadius: "50%", background: vars.color.amethyst, boxShadow: "0 2px 7px rgb(10 15 13 / 28%)", pointerEvents: "auto" });
globalStyle(".chart-brush-handle.nw", { left: 0, top: 0, transform: "translate(-50%, -50%)", cursor: "nwse-resize" });
globalStyle(".chart-brush-handle.ne", { right: 0, top: 0, transform: "translate(50%, -50%)", cursor: "nesw-resize" });
globalStyle(".chart-brush-handle.sw", { left: 0, bottom: 0, transform: "translate(-50%, 50%)", cursor: "nesw-resize" });
globalStyle(".chart-brush-handle.se", { right: 0, bottom: 0, transform: "translate(50%, 50%)", cursor: "nwse-resize" });

globalStyle(".result-context", { position: "absolute", left: "12px", bottom: "12px", zIndex: 25, width: "min(440px, calc(100% - 24px))", padding: "10px", border: `1px solid ${vars.color.strongLine}`, borderTop: `4px solid ${vars.color.amethyst}`, borderRadius: "2px", background: "rgb(255 255 255 / 95%)", boxShadow: "0 14px 38px rgb(10 15 13 / 18%)", backdropFilter: "blur(15px)", WebkitBackdropFilter: "blur(15px)" });
globalStyle(".result-context header", { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" });
globalStyle(".result-context h2", { margin: 0, fontSize: "22px", fontWeight: 300, lineHeight: 1, letterSpacing: "-.05em", textTransform: "lowercase" });
globalStyle(".result-context header p", { maxWidth: "56ch", margin: "3px 0 8px", color: vars.color.muted, fontSize: "8px", lineHeight: 1.4 });
globalStyle(".result-context header > button", { width: "27px", height: "27px", display: "grid", placeItems: "center", border: 0, borderRadius: "50%", background: vars.color.canvas, color: vars.color.muted, cursor: "pointer", fontSize: "20px" });
globalStyle(".result-context-actions", { display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "7px" });
globalStyle(".result-context-status", { margin: "7px 0 0", padding: "6px 7px", borderLeft: `3px solid ${vars.color.teal}`, background: vars.color.tealPale, color: vars.color.tealDark, fontSize: "8px", lineHeight: 1.35 });

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

globalStyle(".panel-resizer", { position: "absolute", zIndex: 35, display: "grid", placeItems: "center", padding: 0, overflow: "visible", border: 0, background: "transparent", touchAction: "none", userSelect: "none" });
globalStyle(".panel-resizer::before", { content: "", position: "absolute", zIndex: 0, background: vars.color.line, transition: "background 120ms ease, box-shadow 120ms ease" });
globalStyle(".panel-resizer span", { position: "relative", zIndex: 1, display: "block", borderRadius: "999px", background: vars.color.strongLine, opacity: .48, transition: "opacity 120ms ease, background 120ms ease" });
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
globalStyle(".source-dock-tabs", { position: "relative", zIndex: 12, minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 31px", background: vars.color.canvas, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".source-dock-tabs nav", { minWidth: 0, display: "flex", overflowX: "auto", scrollbarWidth: "none" });
globalStyle(".source-dock-tabs nav button", { minWidth: "128px", maxWidth: "220px", overflow: "hidden", padding: "4px 9px 3px", border: 0, borderRight: `1px solid ${vars.color.line}`, borderBottom: "3px solid transparent", background: "transparent", color: vars.color.muted, cursor: "pointer", textAlign: "left", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "9px", fontWeight: 420, textTransform: "lowercase" });
globalStyle(".source-dock-tabs nav button.active", { borderBottomColor: vars.color.tealDark, background: vars.color.panel, color: vars.color.ink });
globalStyle(".source-dock-add", { position: "relative" });
globalStyle(".source-dock-add > summary, .inline-source-control > summary, .dwim-column-picker > summary", { width: "100%", height: "100%", display: "grid", placeItems: "center", border: 0, background: vars.color.tealDark, color: vars.color.panel, cursor: "pointer", listStyle: "none", fontSize: "19px", fontWeight: 300 });
globalStyle(".source-dock-add > summary::-webkit-details-marker, .inline-source-control > summary::-webkit-details-marker, .dwim-column-picker > summary::-webkit-details-marker", { display: "none" });
globalStyle(".source-dock-add > div", { position: "absolute", top: "calc(100% + 1px)", right: 0, zIndex: 30, width: "min(620px, 86vw)", maxHeight: "340px", overflow: "auto", padding: "7px", border: `1px solid ${vars.color.strongLine}`, borderTop: `4px solid ${vars.color.teal}`, background: "rgb(255 255 255 / 98%)", boxShadow: "0 18px 44px rgb(10 15 13 / 20%)" });
globalStyle(".source-dock-add > div > header", { display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "4px" });
globalStyle(".source-dock-add > div > header b", { fontSize: "20px", fontWeight: 300, letterSpacing: "-.04em" });
globalStyle(".source-dock-body", { position: "relative", minWidth: 0, minHeight: 0, overflow: "hidden" });

globalStyle(".dwim-command.ai-promoter, .result-context-ai", { width: "auto", minHeight: "42px", display: "grid", gridTemplateColumns: "20px minmax(0, 1fr) auto", alignItems: "center", gap: "7px", margin: "9px 10px", padding: "7px 9px", border: `1px solid ${vars.color.line}`, borderRadius: "4px", background: "rgb(231 237 235 / 55%)", color: vars.color.muted, cursor: "text", textAlign: "left", boxShadow: "inset 3px 3px 10px rgb(42 30 92 / 9%), inset -3px -3px 9px rgb(255 255 255 / 75%)" });
globalStyle(".dwim-command.ai-promoter > span:first-child, .result-context-ai > span:first-child", { color: vars.color.tealDark, fontSize: "14px" });
globalStyle(".dwim-command.ai-promoter > span:nth-child(2), .result-context-ai > span:nth-child(2)", { color: vars.color.muted, fontSize: "9px" });
globalStyle(".dwim-command.ai-promoter > b, .result-context-ai > b", { color: vars.color.tealDark, fontSize: "8px", textTransform: "lowercase" });
globalStyle(".dwim-body.sql-controls", { display: "block", overflow: "auto" });
globalStyle(".dwim-body.sql-controls > section", { overflow: "visible" });
globalStyle(".dwim-body.sql-controls > section + section", { borderTop: `1px solid ${vars.color.line}`, borderLeft: 0 });

globalStyle(".visual-controls > .dwim-visual-section", { padding: "7px 9px" });
globalStyle(".visual-controls > .dwim-visual-section + .dwim-visual-section", { borderTop: `1px solid ${vars.color.line}` });
globalStyle(".visual-controls .dwim-marks", { gridTemplateColumns: "repeat(6, minmax(0, 1fr))" });
globalStyle(".visual-controls .dwim-visual-grid", { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" });
globalStyle(".visual-controls .labels-grid", { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" });
globalStyle(".dwim-field input", { minWidth: 0, width: "100%", padding: "5px", border: `1px solid ${vars.color.line}`, borderRadius: "2px", background: vars.color.panel, color: vars.color.ink, fontSize: "8px" });
globalStyle(".dwim-scale-groups", { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderTop: `1px solid ${vars.color.line}`, borderLeft: `1px solid ${vars.color.line}` });
globalStyle(".dwim-scale-groups > div", { minWidth: 0, display: "grid", gap: "6px", padding: "7px", borderRight: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".dwim-scale-groups > div > b", { color: vars.color.tealDark, fontSize: "8px", fontWeight: 700, textTransform: "lowercase" });

globalStyle(".dwim-source-tiles", { position: "relative", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", borderTop: `1px solid ${vars.color.line}`, borderLeft: `1px solid ${vars.color.line}` });
globalStyle(".dwim-source-tiles > button", { minWidth: 0, display: "grid", gridTemplateColumns: "17px minmax(0, 1fr)", gap: "2px 4px", padding: "8px", border: 0, borderRight: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}`, borderRadius: 0, background: vars.color.panel, color: vars.color.ink, cursor: "pointer", textAlign: "left" });
globalStyle(".dwim-source-tiles > button:hover", { background: vars.color.tealPale });
globalStyle(".dwim-source-tiles > button.active", { background: vars.color.tealPale, boxShadow: `inset 3px 0 ${vars.color.tealDark}` });
globalStyle(".dwim-source-tiles > button > span", { gridRow: "1 / span 2", color: vars.color.tealDark, fontSize: "10px", fontWeight: 800 });
globalStyle(".dwim-source-tiles strong", { minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "9px", fontWeight: 560 });
globalStyle(".dwim-source-tiles small", { minWidth: 0, overflow: "hidden", color: vars.color.muted, textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "7px" });
globalStyle(".dwim-source-tiles.compact", { gridTemplateColumns: "repeat(2, minmax(170px, 1fr))" });
globalStyle(".source-tiles-loading", { gridColumn: "1 / -1", minHeight: "42px", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px", borderRight: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}`, background: "linear-gradient(90deg, rgb(221 245 242 / 45%), rgb(255 255 255 / 88%), rgb(221 245 242 / 45%))", color: vars.color.tealDark, fontSize: "8px", fontWeight: 650, textTransform: "lowercase" });
globalStyle(".source-tiles-loading .spinner", { width: "14px", height: "14px" });

globalStyle(".dwim-column-control", { position: "relative", display: "flex", alignItems: "center", gap: "5px" });
globalStyle(".dwim-selected-fields", { minWidth: 0, display: "flex", flexWrap: "wrap", gap: "3px" });
globalStyle(".dwim-selected-fields > button", { display: "flex", alignItems: "center", gap: "4px", padding: "4px 6px", border: 0, borderBottom: `1px solid ${vars.color.teal}`, borderRadius: 0, background: vars.color.tealPale, color: vars.color.tealDark, cursor: "pointer", fontFamily: "ui-monospace, monospace", fontSize: "7px" });
globalStyle(".dwim-selected-fields > button span", { color: vars.color.muted, fontSize: "10px" });
globalStyle(".dwim-column-picker", { position: "relative", flex: "0 0 auto", width: "28px", height: "28px" });
globalStyle(".dwim-column-picker > summary", { borderRadius: "50%" });
globalStyle(".dwim-column-menu", { position: "absolute", top: "calc(100% + 5px)", right: 0, zIndex: 60, width: "min(520px, calc(100vw - 42px))", maxHeight: "290px", overflow: "auto", padding: "7px", border: `1px solid ${vars.color.strongLine}`, background: vars.color.panel, boxShadow: "0 16px 40px rgb(10 15 13 / 19%)" });
globalStyle(".dwim-column-menu section + section", { marginTop: "8px", paddingTop: "8px", borderTop: `1px solid ${vars.color.line}` });
globalStyle(".dwim-column-menu section > header", { display: "flex", justifyContent: "space-between", gap: "9px", marginBottom: "5px" });
globalStyle(".dwim-column-menu section > header b", { fontSize: "9px", fontWeight: 600 });
globalStyle(".dwim-column-menu section > header span", { color: vars.color.muted, fontFamily: "ui-monospace, monospace", fontSize: "6px" });
globalStyle(".dwim-column-menu section > div", { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderTop: `1px solid ${vars.color.line}`, borderLeft: `1px solid ${vars.color.line}` });
globalStyle(".dwim-column-menu section > div button", { minWidth: 0, display: "grid", gridTemplateColumns: "12px minmax(0, 1fr)", padding: "5px", overflow: "hidden", border: 0, borderRight: `1px solid ${vars.color.line}`, borderBottom: `1px solid ${vars.color.line}`, background: vars.color.panel, color: vars.color.muted, cursor: "pointer", textAlign: "left", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "7px" });
globalStyle(".dwim-column-menu section > div button.active", { background: vars.color.tealPale, color: vars.color.tealDark });
globalStyle(".dwim-column-menu section > div button small", { gridColumn: 2, fontSize: "5px" });

globalStyle(".monaco-editor .monaco-direct-token", { margin: "0 1px", padding: "1px 2px", borderBottom: `1px solid ${vars.color.tealDark}`, borderRadius: "2px 2px 0 0", background: "rgb(221 245 242 / 75%)", cursor: "pointer" });
globalStyle(".monaco-editor .monaco-direct-token.source", { borderBottomColor: vars.color.amethyst, background: "rgb(236 233 248 / 78%)" });
globalStyle(".monaco-editor .monaco-direct-caret", { color: vars.color.tealDark, fontSize: "9px", cursor: "pointer" });
globalStyle(".inline-query-layer", { position: "absolute", inset: 0, zIndex: 8, overflow: "visible", pointerEvents: "none" });
globalStyle(".inline-query-control", { position: "absolute", left: "var(--inline-left)", top: "var(--inline-top)", transform: "translateY(-50%)", pointerEvents: "auto" });
globalStyle(".inline-query-control .dwim-column-picker", { width: "18px", height: "18px" });
globalStyle(".inline-query-control .dwim-column-picker > summary, .inline-source-control > summary", { width: "18px", height: "18px", borderRadius: "50%", fontSize: "13px", boxShadow: "0 2px 7px rgb(10 15 13 / 15%)" });
globalStyle(".inline-select-control .dwim-column-menu", { right: "auto", left: 0 });
globalStyle(".inline-source-control", { width: "18px", height: "18px" });
globalStyle(".inline-source-menu", { position: "absolute", top: "calc(100% + 5px)", left: 0, zIndex: 65, width: "min(540px, calc(100vw - 42px))", maxHeight: "300px", overflow: "auto", padding: "8px", border: `1px solid ${vars.color.strongLine}`, borderTop: `4px solid ${vars.color.teal}`, background: vars.color.panel, boxShadow: "0 16px 42px rgb(10 15 13 / 20%)" });
globalStyle(".inline-source-menu > header", { display: "flex", justifyContent: "space-between", marginBottom: "6px" });
globalStyle(".inline-source-menu > header b", { fontSize: "18px", fontWeight: 300 });
globalStyle(".inline-source-menu > header span", { color: vars.color.muted, fontSize: "7px" });

globalStyle(".result-card", { gridTemplateRows: "39px minmax(0, 1fr) auto" });
globalStyle(".result-toolbar", { minWidth: 0, display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", alignItems: "stretch", background: vars.color.canvas, borderBottom: `1px solid ${vars.color.line}` });
globalStyle(".result-toolbar .result-tabs", { borderBottom: 0 });
globalStyle(".result-toolbar .chart-header-tools", { padding: "3px 8px 3px 0" });
globalStyle(".chart-result-view", { position: "relative", width: "100%", height: "100%", minWidth: 0, minHeight: 0, display: "grid", gridTemplateRows: "auto minmax(0, 1fr)", overflow: "hidden" });
globalStyle(".chart-result-view .chart-header", { minHeight: "80px", display: "block" });
globalStyle(".chart-result-view .chart-view-shell", { minHeight: 0 });
globalStyle(".table-stream-sentinel", { width: "100%", height: "1px" });
globalStyle(".table-stream-status", { minHeight: "29px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "4px 8px", background: vars.color.canvas, borderTop: `1px solid ${vars.color.line}`, color: vars.color.muted, fontSize: "7px" });
globalStyle(".table-stream-progress", { display: "flex", alignItems: "center", gap: "5px" });
globalStyle(".table-stream-progress .spinner", { width: "11px", height: "11px", borderWidth: "1.5px" });
globalStyle(".result-context-ai", { width: "100%", margin: "7px 0 0" });

/* One conversation, scoped to the pane opposite the object being discussed. */
globalStyle(".ai-overlay.placement-left", { inset: "0 auto 0 0", width: "clamp(460px, var(--ai-left-width, 44vw), calc(100vw - 460px))", "@media": { "screen and (max-width: 960px)": { width: "clamp(440px, var(--ai-left-width, 48vw), calc(100vw - 440px))" }, "screen and (max-width: 680px)": { width: "440px" } } });
globalStyle(".ai-overlay.placement-right", { inset: "0 0 0 var(--ai-left-width, 44vw)", width: "auto", "@media": { "screen and (max-width: 960px)": { left: "var(--ai-left-width, 48vw)" }, "screen and (max-width: 680px)": { left: "440px" } } });
globalStyle(".ai-overlay.placement-left .ai-surface", { width: "100%" });
globalStyle(".ai-overlay.placement-right .ai-surface", { width: "min(640px, 100%)", margin: "0 auto 0 0", paddingRight: "26px", paddingLeft: "30px" });
globalStyle("::view-transition-old(chartize-ai-entry), ::view-transition-new(chartize-ai-entry)", { animationDuration: "380ms", animationTimingFunction: "cubic-bezier(.2,.8,.2,1)" });
globalStyle(".ai-overlay::before, .ai-surface, .toolbar-ai-button::before, ::view-transition-old(chartize-ai-entry), ::view-transition-new(chartize-ai-entry)", { "@media": { "(prefers-reduced-motion: reduce)": { animation: "none" } } });

/* Explicit chart exploration: selection zoom, step back, and fit all. */
globalStyle(".chart-explore-controls", { position: "absolute", top: "10px", right: "12px", zIndex: 18, display: "grid", overflow: "hidden", border: `1px solid ${vars.color.strongLine}`, borderRadius: "2px", background: "rgb(255 255 255 / 90%)", boxShadow: "0 5px 16px rgb(10 15 13 / 11%)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" });
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
globalStyle(".map-interaction:active", { cursor: "grabbing" });
globalStyle(".map-interaction .chart-embed", { willChange: "transform" });

/* The active cursor/selection is visible inside the single AI transcript. */
globalStyle(".ai-active-context", { display: "grid", gridTemplateColumns: "92px minmax(0, 1fr)", gap: "8px", margin: "0 3px 14px", padding: "7px 0 7px 10px", borderLeft: `2px solid ${vars.color.tealDark}`, color: vars.color.muted, fontSize: "8px", lineHeight: 1.45 });
globalStyle(".ai-active-context b", { color: vars.color.tealDark, fontSize: "7px", letterSpacing: ".05em", textTransform: "lowercase" });
