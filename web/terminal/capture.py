#!/usr/bin/env python3
"""Records the terminal scene from a real zsh + micro session.

Runs Christopher's own shell setup (oh-my-zsh "jonathan", plugins, micro
settings) inside a detached tmux pane, types the scene's commands key by key
and captures every screen state with colours. Nothing real is touched: HOME
points to a sandbox whose Beruf folder only holds the public CV (from
content/cv.de.json).

  python3 web/terminal/capture.py   ->  web/src/scene/terminal-frames.json

Needs tmux, zsh, micro and ~/.oh-my-zsh. The output is a plain data
file; the site never runs any of this.
"""
import json
import os
import re
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

WEB = Path(__file__).resolve().parents[1]
REPO = WEB.parent
OUT = WEB / "src" / "scene" / "terminal-frames.json"
REAL_HOME = Path.home()
COLS, ROWS = 100, 24
SOCK = "mycv-capture"

CV_FILE = "01_Unterlagen/lebenslauf.md"

# Breeze (Konsole default scheme, used by the Kubuntu profile)
PALETTE = [
    (35, 38, 39), (237, 21, 21), (17, 209, 22), (246, 116, 0),
    (29, 153, 243), (155, 89, 182), (26, 188, 156), (252, 252, 252),
    (127, 140, 141), (192, 57, 43), (28, 220, 154), (253, 188, 75),
    (61, 174, 233), (142, 68, 173), (22, 160, 133), (255, 255, 255),
]


def xterm256(n):
    if n < 16:
        return PALETTE[n]
    if n < 232:
        n -= 16
        steps = [0, 95, 135, 175, 215, 255]
        return steps[n // 36], steps[(n // 6) % 6], steps[n % 6]
    v = 8 + (n - 232) * 10
    return v, v, v


def month(ym):
    y, m = ym.split("-")
    return f"{m}/{y}"


def cv_markdown():
    """Public CV as the markdown file shown in micro (same data as the site)."""
    cv = json.loads((REPO / "content" / "cv.de.json").read_text(encoding="utf-8"))
    out = ["# Lebenslauf", "", "Christopher Elstner · Weiz, Steiermark", "", "## Softwareentwicklung", ""]
    for e in cv["experiences"]:
        end = e["end"] or "2026-09"  # last developer job ended before Siemens Energy (10/2026)
        title = e["position"] + (f" ({e['positionNote']})" if e.get("positionNote") else "")
        org = e["organization"] + (f" ({e['organizationNote']})" if e.get("organizationNote") else "")
        out += [f"### {title}", f"**{org}**, {month(e['start'])} – {month(end)}", ""]
        if e.get("summary"):
            out += [e["summary"], ""]
        out += [f"- {b}" for b in e.get("bullets") or []]
        if e.get("bullets"):
            out.append("")
        if e.get("tech"):
            out += [f"`{'` `'.join(e['tech'])}`", ""]
    out += ["## Ausbildung", ""]
    for ed in cv["education"]:
        if not ed.get("program"):
            continue
        out += [f"### {ed['program']}", f"**{ed['institution']}**, {ed['start']} – {ed['end']}", ""]
        if ed.get("note"):
            out += [ed["note"], ""]
    text = "\n".join(out).rstrip() + "\n"
    assert "\u2014" not in text, "no em-dashes"
    return text


def sandbox():
    sb = Path(tempfile.mkdtemp(prefix="mycv-term-")) / "home"
    sb.mkdir()
    for name in (".oh-my-zsh", ".nvm", "go"):
        if (REAL_HOME / name).exists():
            (sb / name).symlink_to(REAL_HOME / name)
    shutil.copy(REAL_HOME / ".zshrc", sb / ".zshrc")
    (sb / ".config" / "micro").mkdir(parents=True)
    for f in ("settings.json", "bindings.json"):
        if (REAL_HOME / ".config" / "micro" / f).exists():
            shutil.copy(REAL_HOME / ".config" / "micro" / f, sb / ".config" / "micro" / f)
    cv = sb / "nas" / "Beruf" / CV_FILE
    cv.parent.mkdir(parents=True)
    cv.write_text(cv_markdown(), encoding="utf-8")
    (sb / ".cache").mkdir()
    return sb


def tmux(*args):
    return subprocess.run(["tmux", "-L", SOCK, *args], check=True, capture_output=True, text=True).stdout


class Recorder:
    def __init__(self):
        self.frames = []

    def raw(self):
        screen = tmux("capture-pane", "-p", "-e", "-N", "-t", "c")
        x, y, flag, cmd = tmux("display", "-p", "-t", "c",
                               "#{cursor_x} #{cursor_y} #{cursor_flag} #{pane_current_command}").split()
        return screen, (int(x), int(y), flag == "1"), cmd

    def settle(self, before=None, quiet=0.18, timeout=6.0):
        """Waits until the screen differs from `before` and then stays unchanged."""
        t0 = time.time()
        last = self.raw()
        changed_at = time.time() if before is None or last[:2] != before[:2] else None
        while time.time() - t0 < timeout:
            time.sleep(0.03)
            cur = self.raw()
            if cur[:2] != last[:2]:
                last, changed_at = cur, time.time()
            elif changed_at and time.time() - changed_at > quiet:
                break
            elif changed_at is None and cur[:2] != before[:2]:
                changed_at = time.time()
        return last

    def snap(self, mark=None, before=None, quiet=0.18):
        screen, cur, cmd = self.settle(before, quiet)
        self.frames.append({"screen": screen, "cursor": cur, "cmd": cmd, "mark": mark})
        return screen, cur, cmd

    def keys(self, *k, mark=None, quiet=0.18):
        before = self.raw()
        tmux("send-keys", "-t", "c", *k)
        return self.snap(mark, before, quiet)

    def type(self, text, mark=None):
        for ch in text:
            before = self.raw()
            tmux("send-keys", "-t", "c", "-l", ch)
            self.snap(None, before, quiet=0.06)
        self.frames[-1]["mark"] = mark


SGR = re.compile(r"\x1b\[([0-9;:]*)m")


def parse_line(line):
    """ANSI line -> [(text, (fg, bg, bold, italic, underline))] with resolved colours."""
    runs = []
    fg = bg = None
    bold = italic = under = rev = False
    pos = 0

    def push(text):
        if not text:
            return
        f, b = (bg, fg) if rev else (fg, bg)
        if rev:
            f = f or PALETTE[0]
            b = b or (252, 252, 252)
        style = (f, b, bold, italic, under)
        if runs and runs[-1][1] == style:
            runs[-1] = (runs[-1][0] + text, style)
        else:
            runs.append((text, style))

    for m in SGR.finditer(line):
        push(line[pos:m.start()])
        pos = m.end()
        codes = [int(c) if c else 0 for c in re.split("[;:]", m.group(1) or "0")]
        i = 0
        while i < len(codes):
            c = codes[i]
            if c == 0:
                fg = bg = None
                bold = italic = under = rev = False
            elif c == 1:
                bold = True
            elif c == 3:
                italic = True
            elif c == 4:
                under = True
            elif c == 7:
                rev = True
            elif c == 22:
                bold = False
            elif c == 23:
                italic = False
            elif c == 24:
                under = False
            elif c == 27:
                rev = False
            elif 30 <= c <= 37:
                fg = PALETTE[c - 30]
            elif 90 <= c <= 97:
                fg = PALETTE[c - 90 + 8]
            elif 40 <= c <= 47:
                bg = PALETTE[c - 40]
            elif 100 <= c <= 107:
                bg = PALETTE[c - 100 + 8]
            elif c == 39:
                fg = None
            elif c == 49:
                bg = None
            elif c in (38, 48) and i + 1 < len(codes):
                if codes[i + 1] == 5:
                    col = xterm256(codes[i + 2])
                    i += 2
                else:
                    col = tuple(codes[i + 2:i + 5])
                    i += 4
                if c == 38:
                    fg = col
                else:
                    bg = col
            i += 1
    push(line[pos:])
    return runs


def encode(frames, title_dirs, nrows=ROWS):
    """Dedupes lines and styles into tables; frames reference them by index."""
    styles, style_ix = [], {}
    lines, line_ix = [], {}
    out = []
    for fr in frames:
        rows = fr["screen"].split("\n")[:nrows] if fr["screen"] else []
        rows += [""] * (nrows - len(rows))
        ids = []
        for row in rows:
            runs = []
            for text, st in parse_line(row):
                key = json.dumps(st)
                if key not in style_ix:
                    f, b, bold, it, un = st
                    hexc = lambda c: "%02x%02x%02x" % c if c else ""
                    style_ix[key] = len(styles)
                    styles.append([hexc(f), hexc(b), int(bold) | int(it) << 1 | int(un) << 2])
                runs.append([text, style_ix[key]])
            # trailing default-styled blanks carry nothing
            while runs and runs[-1][0].strip() == "" and styles[runs[-1][1]][1] == "":
                runs.pop()
            k = json.dumps(runs, ensure_ascii=False)
            if k not in line_ix:
                line_ix[k] = len(lines)
                lines.append(runs)
            ids.append(line_ix[k])
        x, y, visible = fr["cursor"]
        out.append({"rows": ids, "cur": [x, y] if visible else None,
                    "title": f"{title_dirs(fr)} : {fr['cmd']}", **({"mark": fr["mark"]} if fr["mark"] else {})})
    return {"cols": COLS, "rows": ROWS, "styles": styles, "lines": lines, "frames": out}


def main():
    sb = sandbox()
    conf = sb.parent / "tmux.conf"
    conf.write_text('set -g default-terminal "tmux-256color"\nset -as terminal-features ",*:RGB"\n'
                    "set -g status off\nset -g escape-time 0\n")
    env = (f"HOME={sb} ZDOTDIR={sb} ZSH_CACHE_DIR={sb}/.cache DISABLE_AUTO_UPDATE=true "
           f"COLORTERM=truecolor LANG=de_AT.UTF-8 LC_ALL=de_AT.UTF-8")
    subprocess.run(["tmux", "-L", SOCK, "kill-server"], capture_output=True)
    tmux("-f", str(conf), "new-session", "-d", "-s", "c", "-x", str(COLS), "-y", str(ROWS), "-c", str(sb),
         f"env {env} zsh -i")
    rec = Recorder()
    try:
        t0 = time.time()
        while "\u250c\u2500(" not in rec.raw()[0] and time.time() - t0 < 30:
            time.sleep(0.1)
        rec.settle(None, quiet=0.8)
        rec.keys("clear", "Enter", mark="home", quiet=0.5)
        rec.type("cd ~/nas/Beruf")
        rec.keys("Enter", mark="cd-beruf", quiet=0.6)
        rec.type(f"micro {CV_FILE}")
        rec.keys("Enter", mark="cv-open", quiet=0.8)
        # whole document rendered by micro at once; the site scrolls through it
        tmux("resize-window", "-t", "c", "-y", "220")
        tall, _, _ = rec.settle(rec.raw(), quiet=0.6)
        tmux("resize-window", "-t", "c", "-y", str(ROWS))
        rec.settle(None, quiet=0.4)
        rec.keys("C-q", quiet=0.4)
    finally:
        subprocess.run(["tmux", "-L", SOCK, "kill-server"], capture_output=True)

    if os.environ.get("CAPTURE_RAW"):
        Path(os.environ["CAPTURE_RAW"]).write_text(json.dumps([f["screen"] for f in rec.frames] + [tall]))

    def title_dirs(fr):
        return fr.get("_dir", "")

    # Konsole tab title "%d : %n": current directory name and program
    d = "~"
    for fr in rec.frames:
        if fr["mark"] == "cd-beruf":
            d = "Beruf"
        fr["_dir"] = d
    data = encode(rec.frames, title_dirs)

    # tall capture: rows of the micro buffer without the status line
    tall_rows = tall.rstrip("\n").split("\n")[:-2]  # without micro's status and message lines
    while tall_rows and SGR.sub("", tall_rows[-1]).strip() == "":
        tall_rows.pop()
    doc = encode([{"screen": "\n".join(tall_rows), "cursor": (0, 0, False), "cmd": "micro", "mark": None,
                   "_dir": "Beruf"}], title_dirs, len(tall_rows))
    data["doc"] = {"styles": doc["styles"], "lines": doc["lines"], "rows": doc["frames"][0]["rows"]}
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{len(data['frames'])} frames, {len(data['lines'])} lines, doc {len(doc['lines'])} rows -> {OUT}")
    shutil.rmtree(sb.parent, ignore_errors=True)


if __name__ == "__main__":
    main()
