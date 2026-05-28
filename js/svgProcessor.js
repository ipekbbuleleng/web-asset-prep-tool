export function isSvgFile(file) {
  if (!file) return false;

  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();

  return type === "image/svg+xml" || name.endsWith(".svg");
}

export async function readSvgFile(file) {
  const text = await file.text();

  if (!/<svg[\s>]/i.test(text)) {
    throw new Error("File SVG tidak valid atau tidak memiliki tag <svg>.");
  }

  return text;
}

export function getSvgMeta(svgText) {
  const viewBox = getAttribute(svgText, "viewBox") || getAttribute(svgText, "viewbox") || "";
  const width = normalizeLength(getAttribute(svgText, "width"));
  const height = normalizeLength(getAttribute(svgText, "height"));
  const title = getTagText(svgText, "title");
  const desc = getTagText(svgText, "desc");

  let inferredWidth = width;
  let inferredHeight = height;

  if ((!inferredWidth || !inferredHeight) && viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map((part) => Number(part))
      .filter((value) => Number.isFinite(value));

    if (parts.length === 4) {
      inferredWidth = inferredWidth || String(parts[2]);
      inferredHeight = inferredHeight || String(parts[3]);
    }
  }

  return {
    width: inferredWidth || "-",
    height: inferredHeight || "-",
    viewBox,
    title,
    desc
  };
}

export function optimizeSvgText(svgText, options = {}) {
  const original = String(svgText || "");
  let output = original;

  output = output.replace(/^\uFEFF/, "");
  output = output.replace(/<\?xml[\s\S]*?\?>/gi, "");
  output = output.replace(/<!DOCTYPE[\s\S]*?>/gi, "");

  if (options.removeComments !== false) {
    output = output.replace(/<!--[\s\S]*?-->/g, "");
  }

  // Basic security cleanup.
  output = output.replace(/<script\b[\s\S]*?<\/script>/gi, "");
  output = output.replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, "");
  output = output.replace(/\s(?:href|xlink:href)\s*=\s*(['"])\s*javascript:[\s\S]*?\1/gi, "");

  if (options.removeMetadata !== false) {
    output = output.replace(/<metadata\b[\s\S]*?<\/metadata>/gi, "");
    output = output.replace(/<sodipodi:namedview\b[\s\S]*?<\/sodipodi:namedview>/gi, "");
    output = output.replace(/<rdf:RDF\b[\s\S]*?<\/rdf:RDF>/gi, "");
    output = output.replace(/\s(?:inkscape|sodipodi|serif|sketch|adobe|figma):[a-zA-Z0-9_-]+=(['"])[\s\S]*?\1/g, "");
    output = output.replace(/\sxmlns:(?:inkscape|sodipodi|serif|sketch|adobe|figma)=(['"])[\s\S]*?\1/g, "");
  }

  if (options.keepTitleDesc === false) {
    output = output.replace(/<title\b[\s\S]*?<\/title>/gi, "");
    output = output.replace(/<desc\b[\s\S]*?<\/desc>/gi, "");
    output = output.replace(/\saria-labelledby=(['"])[\s\S]*?\1/gi, "");
  }

  if (options.keepIds === false) {
    output = output.replace(/\sid=(['"])[\s\S]*?\1/gi, "");
  }

  output = output
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+\/>/g, "/>")
    .replace(/\s+>/g, ">")
    .trim();

  const meta = getSvgMeta(output);
  const originalSize = new Blob([original], { type: "image/svg+xml" }).size;
  const outputSize = new Blob([output], { type: "image/svg+xml" }).size;

  return {
    text: output,
    originalSize,
    outputSize,
    meta,
    savings: getSavings(originalSize, outputSize)
  };
}

export function svgTextToObjectUrl(svgText) {
  const blob = new Blob([svgText], { type: "image/svg+xml" });
  return URL.createObjectURL(blob);
}

function getAttribute(svgText, name) {
  const match = svgText.match(new RegExp(`\\s${name}\\s*=\\s*(['"])(.*?)\\1`, "i"));
  return match ? match[2] : "";
}

function normalizeLength(value) {
  if (!value) return "";
  return String(value).trim().replace(/px$/i, "");
}

function getTagText(svgText, tagName) {
  const match = svgText.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? stripTags(match[1]).trim() : "";
}

function stripTags(value) {
  return String(value || "").replace(/<[^>]+>/g, "");
}

function getSavings(originalSize, outputSize) {
  if (!originalSize || !outputSize) return 0;
  return Math.max(0, (1 - outputSize / originalSize) * 100);
}
