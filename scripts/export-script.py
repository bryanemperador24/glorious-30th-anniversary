"""Exports SCRIPT-BREAKDOWN.md as plain text and as print-ready HTML (for PDF).
Usage: python3 -I scripts/export-script.py <in.md> <out.txt> <out.html>
Handles only what the breakdown uses: headings, paragraphs, tables, rules, **bold** and `code`.
"""
import html
import re
import sys
import textwrap

src, out_txt, out_html = sys.argv[1:4]
lines = open(src, encoding="utf-8").read().splitlines()


def plain(s):
    s = re.sub(r"\*\*(.+?)\*\*", r"\1", s)
    return re.sub(r"\*(.+?)\*", r"\1", s).replace("`", "")


def rich(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", s)
    s = re.sub(r"\*(.+?)\*", r"<i>\1</i>", s)
    return re.sub(r"`(.+?)`", r"<code>\1</code>", s)


def cells(row):
    return [c.strip() for c in row.strip().strip("|").split("|")]


# Group into blocks: ("h", level, text) / ("p", text) / ("table", header, rows) / ("hr",)
blocks, i = [], 0
while i < len(lines):
    line = lines[i]
    if line.startswith("#"):
        level = len(line) - len(line.lstrip("#"))
        blocks.append(("h", level, line[level:].strip()))
    elif line.startswith("|"):
        header = cells(line)
        rows = []
        i += 2  # skip the |---| separator
        while i < len(lines) and lines[i].startswith("|"):
            rows.append(cells(lines[i]))
            i += 1
        blocks.append(("table", header, rows))
        continue
    elif line.strip() == "---":
        blocks.append(("hr",))
    elif line.strip():
        blocks.append(("p", line.strip()))
    i += 1

# ---------- TXT ----------
W = 92
txt = []
for b in blocks:
    if b[0] == "h":
        t = plain(b[2])
        if b[1] == 1:
            txt += ["=" * W, t.upper(), "=" * W, ""]
        else:
            txt += ["", t, "-" * len(t)]
    elif b[0] == "p":
        txt += textwrap.wrap(plain(b[1]), W) + [""]
    elif b[0] == "hr":
        txt += ["", "~" * W, ""]
    elif b[0] == "table":
        header, rows = b[1], b[2]
        if header[:3] == ["ID", "In – Out", "Len"]:
            # Speaker lines: one readable entry per line.
            for r in rows:
                rid, span, length, orig, eng, rating = (r + [""] * 6)[:6]
                txt.append(f"{rid:<4} {span:<16} {length:>6}   {plain(rating)}")
                txt += textwrap.wrap(plain(orig), W, initial_indent="     TL: ", subsequent_indent="         ")
                if eng and eng != "(English)":
                    txt += textwrap.wrap(plain(eng), W, initial_indent="     EN: ", subsequent_indent="         ")
                txt.append("")
        else:
            # Short columns share one line; long ones go underneath, wrapped and labelled.
            widths = [max(len(plain(c)) for c in col) for col in zip(header, *rows)]
            short = [k for k, w in enumerate(widths) if w <= 16]
            for r in rows:
                r = (r + [""] * len(header))[: len(header)]
                txt.append("  ".join(plain(r[k]).ljust(widths[k]) for k in short).rstrip())
                for k, h in enumerate(header):
                    if k in short or not r[k]:
                        continue
                    label = f"     {plain(h)}: "
                    txt += textwrap.wrap(plain(r[k]), W, initial_indent=label, subsequent_indent=" " * len(label))
                txt.append("")
open(out_txt, "w", encoding="utf-8").write("\n".join(txt).rstrip() + "\n")

# ---------- HTML ----------
body = []
for b in blocks:
    if b[0] == "h":
        body.append(f"<h{b[1]}>{rich(b[2])}</h{b[1]}>")
    elif b[0] == "p":
        body.append(f"<p>{rich(b[1])}</p>")
    elif b[0] == "hr":
        body.append("<hr>")
    elif b[0] == "table":
        head = "".join(f"<th>{rich(c)}</th>" for c in b[1])
        rows = "".join("<tr>" + "".join(f"<td>{rich(c)}</td>" for c in r) + "</tr>" for r in b[2])
        body.append(f"<table><thead><tr>{head}</tr></thead><tbody>{rows}</tbody></table>")

page = f"""<!doctype html><html><head><meta charset="utf-8"><title>Script Breakdown</title><style>
@page {{ size: A4 landscape; margin: 14mm 12mm; }}
body {{ font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 9.5pt; color: #1a1a1a; line-height: 1.35; }}
h1 {{ font-family: "Times New Roman", serif; font-size: 22pt; font-weight: normal; letter-spacing: .04em; color: #7a1010; border-bottom: 2px solid #c8a46a; padding-bottom: 6px; }}
h2 {{ font-family: "Times New Roman", serif; font-size: 14pt; color: #7a1010; margin: 18px 0 4px; break-after: avoid; }}
p {{ margin: 4px 0; }}
code {{ font-family: Menlo, monospace; font-size: 8.5pt; background: #f4efe6; padding: 0 3px; border-radius: 2px; }}
table {{ width: 100%; border-collapse: collapse; margin: 6px 0 10px; }}
th {{ text-align: left; font-size: 8pt; text-transform: uppercase; letter-spacing: .05em; color: #6b5a3a; border-bottom: 1.5px solid #c8a46a; padding: 4px 6px; }}
td {{ vertical-align: top; padding: 4px 6px; border-bottom: 0.5px solid #e4dccd; }}
tr {{ break-inside: avoid; }}
td:first-child {{ font-weight: bold; white-space: nowrap; }}
hr {{ border: 0; border-top: 1px solid #e4dccd; margin: 14px 0; }}
</style></head><body>{''.join(body)}</body></html>"""
open(out_html, "w", encoding="utf-8").write(page)
print("ok")
