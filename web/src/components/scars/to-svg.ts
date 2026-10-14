import { Fragment, isValidElement, type ReactNode } from "react";

// Tiny JSX → SVG string serializer for the scar art (pure components, no hooks), so the same
// art renders in Wall textures and in server-side share cards without react-dom/server.

// SVG attributes that keep their camelCase spelling.
const CAMEL = new Set(["viewBox", "baseFrequency", "numOctaves", "stdDeviation", "preserveAspectRatio", "gradientUnits", "patternUnits"]);
const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function attrs(props: Record<string, unknown>) {
  let out = "";
  for (const [k, v] of Object.entries(props)) {
    if (k === "children" || k === "key" || k === "ref" || v === undefined || v === null || v === false) continue;
    if (k === "style" && typeof v === "object") {
      const css = Object.entries(v as Record<string, string | number>)
        .map(([sk, sv]) => `${kebab(sk)}:${sv}`)
        .join(";");
      out += ` style="${esc(css)}"`;
      continue;
    }
    const name = k === "className" ? "class" : k.startsWith("data-") || k.startsWith("aria-") || CAMEL.has(k) ? k : kebab(k);
    out += ` ${name}="${esc(String(v))}"`;
  }
  return out;
}

export function toSvg(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return esc(String(node));
  if (Array.isArray(node)) return node.map(toSvg).join("");
  if (!isValidElement(node)) return "";
  const { type } = node;
  const props = node.props as Record<string, unknown> & { children?: ReactNode };
  if (type === Fragment) return toSvg(props.children);
  if (typeof type === "function") return toSvg((type as (p: unknown) => ReactNode)(props));
  if (typeof type === "string") return `<${type}${attrs(props)}>${toSvg(props.children)}</${type}>`;
  return "";
}
