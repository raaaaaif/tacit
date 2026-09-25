import fs from "node:fs";

const version = fs
  .readFileSync("src/model/geometry.ts", "utf8")
  .match(/MODEL_VERSION = "([^"]+)"/)[1];
const escape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const inline = (value) =>
  escape(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\[([^\]]+)\]\((https:\/\/[^)]+|methods\.md)\)/g,
      (_, label, url) =>
        `<a href="${url === "methods.md" ? "methods.html" : url}">${label}</a>`,
    );
function render(source) {
  return source
    .trim()
    .split(/\n\s*\n/)
    .map((block) => {
      const heading = block.match(/^(#{1,3}) (.+)$/);
      if (heading)
        return `<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`;
      if (/^(?:- |\d+\. )/.test(block)) {
        const tag = block.startsWith("- ") ? "ul" : "ol";
        return (
          `<${tag}>` +
          block
            .split("\n")
            .map(
              (line) =>
                `<li>${inline(line.replace(/^(?:- |\d+\. )/, ""))}</li>`,
            )
            .join("") +
          `</${tag}>`
        );
      }
      if (block.startsWith("|")) {
        const rows = block
          .split("\n")
          .filter((line) => !/^\|[\s:|-]+\|$/.test(line));
        const cells = (line, tag) =>
          line
            .split("|")
            .slice(1, -1)
            .map((cell) => `<${tag}>${inline(cell.trim())}</${tag}>`)
            .join("");
        return `<div class="table-scroll" tabindex="0" role="region" aria-label="Reference table"><table><thead><tr>${cells(rows[0], "th")}</tr></thead><tbody>${rows
          .slice(1)
          .map((row) => `<tr>${cells(row, "td")}</tr>`)
          .join("")}</tbody></table></div>`;
      }
      return "<p>" + inline(block.replaceAll("\n", " ")) + "</p>";
    })
    .join("\n");
}
const style = `*{box-sizing:border-box}body{margin:0;background:#eeede6;color:#27352e;font:16px/1.75 system-ui,sans-serif}main{max-width:820px;margin:60px auto;padding:0 28px 80px}nav{display:flex;justify-content:space-between;gap:20px;border-bottom:1px solid #ced3c7;padding-bottom:20px;margin-bottom:55px;font-size:13px}a{color:#365f47;text-underline-offset:3px}h1{font-size:38px;line-height:1.15;letter-spacing:-1.4px;margin-bottom:35px}h2{font-size:23px;margin-top:48px;font-weight:550;letter-spacing:-.4px}p{margin:20px 0}li{margin:12px 0}code{font-size:13px;overflow-wrap:anywhere}strong{font-weight:600}.table-scroll{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;vertical-align:top;padding:12px;border-bottom:1px solid #ced3c7}th{font-weight:600}a:focus-visible,.table-scroll:focus-visible{outline:2px solid #365f47;outline-offset:4px}@media(max-width:600px){main{margin-top:28px;padding:0 20px 60px}h1{font-size:30px}th,td{padding:9px}nav{flex-wrap:wrap}}`;
fs.mkdirSync("public/docs", { recursive: true });
for (const [name, title] of [
  ["methods", "Model & evidence"],
  ["start-here", "Start here"],
]) {
  const blocks = render(fs.readFileSync(`docs/${name}.md`, "utf8"));
  fs.writeFileSync(
    `public/docs/${name}.html`,
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TACIT — ${title}</title><style>${style}</style><main><nav><a href="/">← TACIT workbench</a><span>${title} / ${version}</span></nav>${blocks}</main></html>`,
  );
}
