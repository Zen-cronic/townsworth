// Switchable visual themes. `?theme=locate|guide|packet` picks one and remembers it for later pages
// in this browser; `?theme=default` returns to the standard look. Runs inline in <head>, before
// first paint, so a themed page never flashes the default palette.
export const THEMES = ["locate", "guide", "packet"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_SCRIPT = `(function(){try{var t=${JSON.stringify(THEMES)};var k="gn-theme";var q=new URLSearchParams(location.search).get("theme");var v=null;if(q!==null){if(t.indexOf(q)>=0){v=q;try{localStorage.setItem(k,q)}catch(e){}}else{try{localStorage.removeItem(k)}catch(e){}}}else{try{v=localStorage.getItem(k)}catch(e){}if(t.indexOf(v)<0)v=null}if(v)document.documentElement.setAttribute("data-theme",v)}catch(e){}})();`;
