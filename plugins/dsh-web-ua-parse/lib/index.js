/**
 * Web 工具：ua parse — Web 工具
 */

export const name = "dsh-web-ua-parse";
export const inject = ["tools"];

const NL = String.fromCharCode(10);
const SITE = "https://deepseekbase.com/zh/tools/";
const TEXT_OUTPUT = {
  schema: { type: "object", additionalProperties: false, properties: { text: { type: "string" } }, required: ["text"] },
  render: (_args, value) => [{ type: "text", text: (value && value.text) || "" }],
};

function U(t) { try { return new URL(String(t).trim()); } catch (e) { throw new Error("URL 无效"); } }
function one(re, t) { const m = String(t).match(re); return m ? m[1] : ""; }
function all(re, t) { const out = []; let m; const r = new RegExp(re.source, re.flags.indexOf("g") >= 0 ? re.flags : re.flags + "g"); while ((m = r.exec(String(t))) !== null) { out.push(m[1]); if (out.length > 500) break; } return out; }

const OPS = {
  url_parse: (t) => { const u = U(t); return JSON.stringify({ protocol: u.protocol, host: u.host, path: u.pathname, query: u.search, hash: u.hash, params: Object.fromEntries(u.searchParams) }, null, 2); },
  url_build: (t) => { const o = JSON.parse(t); const u = new URL(o.base || "https://example.com"); if (o.path) u.pathname = o.path; const p = o.params || {}; Object.keys(p).forEach((k) => u.searchParams.set(k, p[k])); if (o.hash) u.hash = o.hash; return u.toString(); },
  url_join: (t, a) => new URL(String(a), String(t).trim()).toString(),
  url_normalize: (t) => { const u = U(t); u.hostname = u.hostname.toLowerCase(); if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) u.port = ""; u.hash = ""; return u.toString(); },
  url_domain: (t) => U(t).hostname,
  url_path: (t) => U(t).pathname,
  url_query: (t) => U(t).search.replace(/^\?/, ""),
  url_add_param: (t, a) => { const [k, v] = String(a).split("="); const u = U(t); u.searchParams.set(k, v === undefined ? "" : v); return u.toString(); },
  url_remove_param: (t, a) => { const u = U(t); u.searchParams.delete(String(a)); return u.toString(); },
  url_query_to_json: (t) => JSON.stringify(Object.fromEntries(new URLSearchParams(String(t).replace(/^\?/, ""))), null, 2),
  json_to_query: (t) => new URLSearchParams(JSON.parse(t)).toString(),
  extract_links: (t) => all(/href="([^"]+)"/gi, t).join(NL),
  extract_images: (t) => all(/<img[^>]+src="([^"]+)"/gi, t).join(NL),
  meta_title: (t) => one(/<title>([^<]*)<\/title>/i, t) || "未找到 title",
  meta_description: (t) => one(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i, t) || "未找到 description",
  og_tags: (t) => { const out = []; const re = /<meta[^>]+property="(og:[^"]+)"[^>]+content="([^"]*)"/gi; let m; while ((m = re.exec(String(t))) !== null) out.push(m[1] + " = " + m[2]); return out.join(NL) || "未找到 og 标签"; },
  canonical: (t) => one(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/i, t) || "未找到 canonical",
  html_tag_count: (t) => { const tags = all(/<([a-zA-Z][a-zA-Z0-9-]*)/g, t); const m = {}; tags.forEach((x) => { const k = x.toLowerCase(); m[k] = (m[k] || 0) + 1; }); return Object.keys(m).sort((a, b) => m[b] - m[a]).map((k) => k + ": " + m[k]).join(NL); },
  css_minify: (t) => String(t).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*([{}:;,>])\s*/g, "$1").trim(),
  css_colors: (t) => { const hex = all(/#[0-9a-fA-F]{3,8}/g, t); const rgb = all(/rgba?\([^)]+\)/g, t); return Array.from(new Set(hex.concat(rgb))).join(NL) || "未找到颜色"; },
  http_header_parse: (t) => { const out = []; String(t).split(NL).forEach((line) => { const i = line.indexOf(":"); if (i > 0) out.push(line.slice(0, i).trim().toLowerCase() + " = " + line.slice(i + 1).trim()); }); return out.join(NL); },
  http_header_build: (t) => { const o = JSON.parse(t); return Object.keys(o).map((k) => k + ": " + o[k]).join(NL); },
  cookie_parse: (t) => String(t).split(";").map((x) => x.trim()).filter(Boolean).map((x) => { const i = x.indexOf("="); return (i > 0 ? x.slice(0, i) : x) + " = " + (i > 0 ? x.slice(i + 1) : ""); }).join(NL),
  cookie_build: (t) => { const o = JSON.parse(t); return Object.keys(o).map((k) => k + "=" + o[k]).join("; "); },
  ua_parse: (t) => {
    const s = String(t); const out = [];
    out.push("浏览器: " + (/Edg\//.test(s) ? "Edge" : /Chrome\//.test(s) ? "Chrome" : /Firefox\//.test(s) ? "Firefox" : /Safari\//.test(s) ? "Safari" : "未知"));
    out.push("系统: " + (/Windows/.test(s) ? "Windows" : /Android/.test(s) ? "Android" : /iPhone|iPad/.test(s) ? "iOS" : /Mac OS X/.test(s) ? "macOS" : /Linux/.test(s) ? "Linux" : "未知"));
    out.push("移动端: " + (/Mobile|Android|iPhone/.test(s) ? "是" : "否"));
    return out.join(NL);
  },
  is_mobile: (t) => /Mobile|Android|iPhone|iPad/i.test(String(t)) ? "移动端" : "非移动端",
  basic_auth: (t) => "Authorization: Basic " + btoa(String(t)),
  bearer: (t) => "Authorization: Bearer " + String(t).trim(),
  jsonld_extract: (t) => {
    const out = []; const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi; let m;
    while ((m = re.exec(String(t))) !== null) { try { out.push(JSON.stringify(JSON.parse(m[1].trim()), null, 2)); } catch (e) { out.push(m[1].trim()); } }
    return out.join(NL + "---" + NL) || "未找到 JSON-LD";
  },
  sitemap_urls: (t) => all(/<loc>([^<]+)<\/loc>/gi, t).join(NL),
  robots_parse: (t) => String(t).split(NL).map((x) => x.trim()).filter((x) => x && !x.startsWith("#")).join(NL),
  domain_tld: (t) => { const h = U(t).hostname; const p = h.split("."); return p.length > 1 ? p.slice(-1)[0] : "无"; },
  subdomain: (t) => { const h = U(t).hostname; const p = h.split("."); return p.length > 2 ? p.slice(0, -2).join(".") : "无"; },
  is_ip: (t) => /^(\d{1,3}\.){3}\d{1,3}$/.test(String(t).trim()) ? "是 IP" : "不是 IP",
  url_params_count: (t) => "参数个数: " + Array.from(U(t).searchParams).length,
  html_comments: (t) => all(/<!--([\s\S]*?)-->/g, t).map((x) => x.trim()).join(NL + "---" + NL) || "无注释",
  html_scripts: (t) => all(/<script[^>]+src="([^"]+)"/gi, t).join(NL),
  html_styles: (t) => all(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/gi, t).join(NL),
  form_actions: (t) => all(/<form[^>]+action="([^"]*)"/gi, t).join(NL),
  heading_outline: (t) => { const out = []; const re = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi; let m; while ((m = re.exec(String(t))) !== null) out.push(new Array(Number(m[1])).join("  ") + "- " + m[2].replace(/<[^>]+>/g, "").trim()); return out.slice(0, 100).join(NL); },
};

export function apply(ctx, config) {
  void config;
  ctx.tools.register({
    name: "web_ua_parse",
    description: "ua parse",
    parameters: {
      text: { "type": "string", required: true, "description": "输入" },
    },
    output: TEXT_OUTPUT,
    async execute(args) {
      const t = args && args.text != null ? String(args.text) : "";
      const a = args && args.a != null ? String(args.a) : "";
      try {
        const fn = OPS["ua_parse"];
        if (!fn) throw new Error("未知操作");
        return { text: ["Web 工具：ua parse", "=".repeat(52), String(await fn(t, a)), "", "更多工具：" + SITE].join(NL) };
      } catch (e) {
        return { text: "处理失败: " + String((e && e.message) || e) };
      }
    },
  });
}
