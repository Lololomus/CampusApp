# ===== FILE: renderer.py =====
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping

from PIL import Image, ImageDraw, ImageFont

from .core import normalize_payload
from .model import BBoxes, ElementOffsets

# ─── Colors ───────────────────────────────────────────────────────────────────
BG_COLOR     = "#0A0A0A"
LIME_COLOR   = "#CCFF00"
PINK_COLOR   = "#FF3366"
WHITE        = "#FFFFFF"
TEXT_MUTED   = "#A0A0A0"
FOOTER_MUTED = "#666666"

# ─── Fonts ────────────────────────────────────────────────────────────────────
_FONTS_DIR = Path(__file__).parent / "fonts"

_FONT_FILES: dict[str, list[str]] = {
    "black":  ["Montserrat-Black.ttf"],
    "bold":   ["Montserrat-Bold.ttf", "Montserrat-Black.ttf"],
    "medium": ["Montserrat-Medium.ttf", "Montserrat-Regular.ttf"],
}
_SYSTEM_FALLBACKS = ["arial.ttf", "segoeui.ttf"]


@lru_cache(maxsize=32)
def _load_font(weight: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for name in _FONT_FILES.get(weight, []):
        for path in (_FONTS_DIR / name, Path(name)):
            try:
                return ImageFont.truetype(str(path), size=size)
            except Exception:
                continue
    for name in _SYSTEM_FALLBACKS:
        try:
            return ImageFont.truetype(name, size=size)
        except Exception:
            continue
    return ImageFont.load_default()


# ─── Layout configs per format ────────────────────────────────────────────────
_LAYOUTS: dict[str, dict[str, Any]] = {
    "square": {
        "size": (1080, 1080),
        "pad_x": 86,  "pad_y": 86,
        "title_size": 118, "title_gap": 135,
        "badge_w": 140, "badge_h": 56, "badge_font": 32,
        "date_font": 24,
        "divider_offset": 295,
        "col_width": 420, "col_gap": 50,
        "col_title_font": 36,
        "list_head_font": 28, "list_text_font": 24,
        "block_height": 118, "items_top_offset": 70,
        "footer_font": 24, "footer_from_bottom": 106,
        "title_lh": 32, "text_lh": 28,
    },
    "story": {
        "size": (1080, 1920),
        "pad_x": 86,  "pad_y": 120,
        "title_size": 118, "title_gap": 140,
        "badge_w": 140, "badge_h": 56, "badge_font": 32,
        "date_font": 24,
        "divider_offset": 330,
        "col_width": 420, "col_gap": 50,
        "col_title_font": 36,
        "list_head_font": 28, "list_text_font": 24,
        "block_height": 148, "items_top_offset": 76,
        "footer_font": 24, "footer_from_bottom": 140,
        "title_lh": 32, "text_lh": 28,
    },
    "banner": {
        # 1920x1080: две колонки по 800px с зазором 120px
        # 2*100 + 2*800 + 120 = 1920 — точно заполняет ширину
        "size": (1920, 1080),
        "pad_x": 100, "pad_y": 72,
        "title_size": 96,  "title_gap": 112,
        "badge_w": 140, "badge_h": 52, "badge_font": 30,
        "date_font": 22,
        "divider_offset": 250,
        "col_width": 800, "col_gap": 120,
        "col_title_font": 34,
        "list_head_font": 26, "list_text_font": 22,
        "block_height": 108, "items_top_offset": 62,
        "footer_font": 22, "footer_from_bottom": 100,
        "title_lh": 30, "text_lh": 26,
    },
}


def _wrap_text(
    draw: ImageDraw.ImageDraw,
    text: str,
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    max_width: int,
    max_lines: int,
) -> list[str]:
    raw = text.strip()
    if not raw:
        return [""]

    words = raw.split()
    lines: list[str] = []
    current = words[0]

    for word in words[1:]:
        attempt = f"{current} {word}"
        if draw.textlength(attempt, font=font) <= max_width:
            current = attempt
            continue
        lines.append(current)
        current = word
        if len(lines) >= max_lines - 1:
            break

    lines.append(current)
    lines = lines[:max_lines]

    joined = " ".join(words)
    rendered = " ".join(lines)
    if joined != rendered and lines:
        ellipsis = "..."
        last = lines[-1]
        while last and draw.textlength(last + ellipsis, font=font) > max_width:
            last = last[:-1]
        lines[-1] = (last + ellipsis) if last else ellipsis
    return lines


def _draw_item_block(
    draw: ImageDraw.ImageDraw,
    item: Mapping[str, Any],
    x: int,
    y: int,
    width: int,
    title_font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    text_font: ImageFont.FreeTypeFont | ImageFont.ImageFont,
    title_lh: int,
    text_lh: int,
) -> None:
    title_lines = _wrap_text(draw, str(item.get("title", "")), title_font, width, max_lines=2)
    text_lines  = _wrap_text(draw, str(item.get("text",  "")), text_font,  width, max_lines=3)

    cursor_y = y
    for line in title_lines:
        draw.text((x, cursor_y), line, font=title_font, fill=WHITE, anchor="lt")
        cursor_y += title_lh

    cursor_y += 4
    for line in text_lines:
        draw.text((x, cursor_y), line, font=text_font, fill=TEXT_MUTED, anchor="lt")
        cursor_y += text_lh


def render_update_image(
    raw_payload: Mapping[str, Any],
    fmt: str = "square",
    offsets: ElementOffsets | None = None,
) -> tuple[Image.Image, BBoxes]:
    """Рендерит карточку обновления. Возвращает (image, bboxes_элементов)."""
    payload = normalize_payload(raw_payload)
    L   = _LAYOUTS.get(fmt, _LAYOUTS["square"])
    ofs = offsets or {}
    bboxes: BBoxes = {}

    width, height = L["size"]
    pad_x, pad_y  = L["pad_x"], L["pad_y"]

    # ── Шрифты ──
    f_title     = _load_font("black",  L["title_size"])
    f_badge     = _load_font("bold",   L["badge_font"])
    f_date      = _load_font("bold",   L["date_font"])
    f_col_title = _load_font("bold",   L["col_title_font"])
    f_list_head = _load_font("bold",   L["list_head_font"])
    f_list_text = _load_font("medium", L["list_text_font"])
    f_footer_l  = _load_font("medium", L["footer_font"])
    f_footer_r  = _load_font("bold",   L["footer_font"])

    img = Image.new("RGBA", (width, height), color=BG_COLOR)

    # ── Сетка на отдельном прозрачном слое ──
    grid_layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    grid_draw  = ImageDraw.Draw(grid_layer)
    grid_step  = int(width * 0.047)
    for off in range(0, max(width, height), grid_step):
        grid_draw.line([(off, 0), (off, height)], fill=(255, 255, 255, 15), width=1)
        grid_draw.line([(0, off), (width, off)],  fill=(255, 255, 255, 15), width=1)
    img = Image.alpha_composite(img, grid_layer)

    draw = ImageDraw.Draw(img)

    # ── Базовые позиции (без смещений) ──
    line_y_base    = pad_y + L["divider_offset"]
    start_y_base   = line_y_base + 50
    items_top_base = start_y_base + L["items_top_offset"]
    footer_y_base  = height - L["footer_from_bottom"]
    col1_x_base    = pad_x
    col2_x_base    = pad_x + L["col_width"] + L["col_gap"]

    # ── Заголовок (двустрочный) ──
    dx, dy = ofs.get("title", (0, 0))
    tx, ty1 = pad_x + dx, pad_y + dy
    ty2 = ty1 + L["title_gap"]
    draw.text((tx, ty1), payload["title_line_1"], font=f_title, fill=WHITE,      anchor="lt")
    draw.text((tx, ty2), payload["title_line_2"], font=f_title, fill=LIME_COLOR, anchor="lt")
    bboxes["title"] = (tx, ty1, tx + int(width * 0.65), ty2 + L["title_size"] + 10)

    # ── Плашка версии ──
    dx, dy = ofs.get("badge", (0, 0))
    bw, bh = L["badge_w"], L["badge_h"]
    bx1 = width - pad_x - bw + dx
    bx2 = width - pad_x + dx
    by1 = pad_y + 20 + dy
    by2 = by1 + bh
    draw.rounded_rectangle([bx1, by1, bx2, by2], radius=bh // 2, fill=LIME_COLOR)
    draw.text(
        ((bx1 + bx2) / 2, (by1 + by2) / 2 - 2),
        f"v {payload['version']}",
        font=f_badge, fill=BG_COLOR, anchor="mm",
    )
    bboxes["badge"] = (bx1, by1, bx2, by2)

    # ── Дата ──
    dx, dy = ofs.get("date", (0, 0))
    date_base_y = pad_y + 20 + bh + 14
    draw.text(
        (width - pad_x + dx, date_base_y + dy),
        payload["date"],
        font=f_date, fill="#888888", anchor="rt",
    )
    date_w = int(len(payload["date"]) * L["date_font"] * 0.62)
    bboxes["date"] = (
        width - pad_x - date_w + dx, date_base_y - L["date_font"] + dy,
        width - pad_x + dx,          date_base_y + 8 + dy,
    )

    # ── Разделительная линия ──
    dx, dy = ofs.get("divider", (0, 0))
    line_y = line_y_base + dy
    draw.line([(pad_x + dx, line_y), (width - pad_x + dx, line_y)], fill=LIME_COLOR, width=3)
    bboxes["divider"] = (pad_x + dx, line_y - 8, width - pad_x + dx, line_y + 8)

    # ── Колонка «Что добавили» ──
    dx, dy = ofs.get("col_features", (0, 0))
    c1x  = col1_x_base + dx
    c1y  = start_y_base + dy
    it1y = items_top_base + dy
    n1   = len(payload["features"])

    draw.rectangle([c1x, c1y, c1x + 24, c1y + 24], fill=LIME_COLOR)
    draw.text((c1x + 40, c1y + 12), "ЧТО ДОБАВИЛИ", font=f_col_title, fill=WHITE, anchor="lm")

    for idx, item in enumerate(payload["features"]):
        _draw_item_block(
            draw, item, c1x, it1y + idx * L["block_height"],
            L["col_width"], f_list_head, f_list_text, L["title_lh"], L["text_lh"],
        )
    bboxes["col_features"] = (c1x, c1y, c1x + L["col_width"], it1y + max(n1, 1) * L["block_height"])

    # ── Колонка «Что починили» ──
    dx, dy = ofs.get("col_fixes", (0, 0))
    c2x  = col2_x_base + dx
    c2y  = start_y_base + dy
    it2y = items_top_base + dy
    n2   = len(payload["fixes"])

    draw.rectangle([c2x, c2y, c2x + 24, c2y + 24], fill=PINK_COLOR)
    draw.text((c2x + 40, c2y + 12), "ЧТО ПОЧИНИЛИ", font=f_col_title, fill=WHITE, anchor="lm")

    for idx, item in enumerate(payload["fixes"]):
        _draw_item_block(
            draw, item, c2x, it2y + idx * L["block_height"],
            L["col_width"], f_list_head, f_list_text, L["title_lh"], L["text_lh"],
        )
    bboxes["col_fixes"] = (c2x, c2y, c2x + L["col_width"], it2y + max(n2, 1) * L["block_height"])

    # ── Футер ──
    dx, dy = ofs.get("footer", (0, 0))
    footer_y = footer_y_base + dy
    draw.line([(pad_x + dx, footer_y - 40), (width - pad_x + dx, footer_y - 40)], fill="#2A2A2A", width=1)
    draw.text((pad_x + dx,         footer_y), payload["footer_left"],  font=f_footer_l, fill=FOOTER_MUTED, anchor="ls")
    draw.text((width - pad_x + dx, footer_y), payload["footer_right"], font=f_footer_r, fill=WHITE,        anchor="rs")
    bboxes["footer"] = (pad_x + dx, footer_y - 44, width - pad_x + dx, footer_y + 8)

    return img.convert("RGB"), bboxes
