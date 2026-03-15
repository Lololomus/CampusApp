# ===== FILE: app.py =====
from __future__ import annotations

import sys
import tkinter as tk
from pathlib import Path
from tkinter import messagebox

import customtkinter as ctk
from PIL import Image, ImageTk

if __package__ in (None, ""):
    PROJECT_ROOT = Path(__file__).resolve().parents[2]
    if str(PROJECT_ROOT) not in sys.path:
        sys.path.append(str(PROJECT_ROOT))
    from tools.pillow_update_desktop.core import save_update, validate_payload
    from tools.pillow_update_desktop.model import MAX_ITEMS, MIN_ITEMS, BBoxes, ElementOffsets, default_payload
    from tools.pillow_update_desktop.renderer import render_update_image
else:
    from .core import save_update, validate_payload
    from .model import MAX_ITEMS, MIN_ITEMS, BBoxes, ElementOffsets, default_payload
    from .renderer import render_update_image

# Метки форматов → строка для renderer
_FORMAT_MAP = {
    "1:1  Квадрат": "square",
    "9:16  Сторис": "story",
    "16:9  Баннер": "banner",
}
_FORMAT_LABELS = list(_FORMAT_MAP.keys())


class PillowUpdateDesktopApp(ctk.CTk):
    def __init__(self) -> None:
        super().__init__()
        self.title("PillowUpdate Desktop")
        self.geometry("1680x960")
        self.minsize(1380, 820)

        ctk.set_appearance_mode("dark")
        ctk.set_default_color_theme("blue")

        self.project_root = Path(__file__).resolve().parents[2]

        # ── Состояние рендера ──
        self._last_rendered: Image.Image | None = None
        self._bboxes: BBoxes = {}
        self._offsets: ElementOffsets = {}
        self._fmt: str = "square"

        # ── Canvas / drag ──
        self._canvas_photo: ImageTk.PhotoImage | None = None  # ссылка нужна, иначе GC удалит
        self._canvas_scale: float = 1.0
        self._canvas_img_offset: tuple[int, int] = (0, 0)
        self._selected_elem: str | None = None
        self._drag_start_canvas: tuple[int, int] | None = None
        self._drag_start_offset: tuple[int, int] = (0, 0)
        self._overlay_ids: dict[str, int] = {}

        # ── Живое превью ──
        self._preview_job: str | None = None

        # ── Динамические виджеты фич/фиксов ──
        self._feature_widgets: list[dict] = []
        self._fix_widgets: list[dict] = []

        self._build_layout()
        self._fill_defaults()
        # первый рендер — после того как Tk отрисует окно
        self.after(150, lambda: self.on_preview(silent=True))

    # ──────────────────────────────────────────────────────────────────────────
    # Layout
    # ──────────────────────────────────────────────────────────────────────────

    def _build_layout(self) -> None:
        self.grid_columnconfigure(0, weight=0)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        self.form_panel = ctk.CTkScrollableFrame(self, width=520, corner_radius=0)
        self.form_panel.grid(row=0, column=0, sticky="nsew")
        self.form_panel.grid_columnconfigure(0, weight=1)

        self.preview_panel = ctk.CTkFrame(self, corner_radius=0)
        self.preview_panel.grid(row=0, column=1, sticky="nsew", padx=14, pady=14)
        self.preview_panel.grid_columnconfigure(0, weight=1)
        self.preview_panel.grid_rowconfigure(1, weight=1)

        self._build_preview_panel()
        self._build_form_controls()

    def _build_preview_panel(self) -> None:
        # ── Верхняя строка: заголовок + инфо о выбранном элементе ──
        top = ctk.CTkFrame(self.preview_panel, fg_color="transparent")
        top.grid(row=0, column=0, sticky="ew", padx=16, pady=(16, 4))
        top.grid_columnconfigure(1, weight=1)

        ctk.CTkLabel(top, text="Превью", font=ctk.CTkFont(size=22, weight="bold")).grid(
            row=0, column=0, sticky="w"
        )

        self._drag_info_var = ctk.StringVar(value="Кликните на зону в превью — перетащите для смещения")
        ctk.CTkLabel(
            top,
            textvariable=self._drag_info_var,
            font=ctk.CTkFont(size=12),
            text_color="#6B7280",
            justify="left",
        ).grid(row=0, column=1, sticky="w", padx=(16, 0))

        ctk.CTkButton(
            top, text="Сбросить позиции", width=140,
            fg_color="#374151", hover_color="#4B5563",
            command=self._reset_offsets,
        ).grid(row=0, column=2, sticky="e", padx=(8, 0))

        # ── Canvas (заменяет CTkLabel) ──
        self._canvas = tk.Canvas(
            self.preview_panel,
            bg="#111111",
            highlightthickness=0,
            cursor="",
        )
        self._canvas.grid(row=1, column=0, sticky="nsew", padx=16, pady=(4, 16))

        self._canvas.bind("<Button-1>",        self._on_canvas_press)
        self._canvas.bind("<B1-Motion>",       self._on_canvas_drag)
        self._canvas.bind("<ButtonRelease-1>", self._on_canvas_release)
        self._canvas.bind("<Motion>",          self._on_canvas_hover)
        self._canvas.bind("<Configure>",       self._on_canvas_resize)

        # ── Статус ──
        self.status_var = ctk.StringVar(value="Заполните поля.")
        ctk.CTkLabel(
            self.preview_panel,
            textvariable=self.status_var,
            font=ctk.CTkFont(size=12),
            text_color="#9CA3AF",
        ).grid(row=2, column=0, sticky="w", padx=16, pady=(0, 8))

    def _build_form_controls(self) -> None:
        fp = self.form_panel

        ctk.CTkLabel(fp, text="PillowUpdate Editor", font=ctk.CTkFont(size=22, weight="bold")).grid(
            row=0, column=0, sticky="w", padx=16, pady=(16, 4)
        )

        # ── Формат ──
        self._fmt_var = ctk.StringVar(value=_FORMAT_LABELS[0])
        ctk.CTkSegmentedButton(
            fp,
            values=_FORMAT_LABELS,
            variable=self._fmt_var,
            command=self._on_format_change,
        ).grid(row=1, column=0, sticky="ew", padx=16, pady=(4, 8))

        # ── Кнопки ──
        btn_row = ctk.CTkFrame(fp, fg_color="transparent")
        btn_row.grid(row=2, column=0, sticky="ew", padx=16, pady=(0, 12))
        btn_row.grid_columnconfigure((0, 1), weight=1)

        ctk.CTkButton(btn_row, text="Обновить превью", command=self.on_preview).grid(
            row=0, column=0, padx=(0, 6), sticky="ew"
        )
        ctk.CTkButton(btn_row, text="Сохранить", command=self.on_save).grid(
            row=0, column=1, padx=(6, 0), sticky="ew"
        )

        # ── Основные поля ──
        self.date_entry         = self._add_entry("Дата (DD.MM.YYYY)", row=3)
        self.version_entry      = self._add_entry("Версия",            row=4)
        self.title_1_entry      = self._add_entry("Заголовок 1",       row=5)
        self.title_2_entry      = self._add_entry("Заголовок 2",       row=6)
        self.footer_left_entry  = self._add_entry("Футер слева",       row=7)
        self.footer_right_entry = self._add_entry("Футер справа",      row=8)

        # ── Секция «Что добавили» ──
        self._features_header = self._build_section_header(
            row=9,
            title="Что добавили",
            add_fn=self._add_feature,
            remove_fn=self._remove_feature,
        )
        self._features_container = ctk.CTkFrame(fp, fg_color="transparent")
        self._features_container.grid(row=10, column=0, sticky="ew")

        # ── Секция «Что починили» ──
        self._fixes_header = self._build_section_header(
            row=11,
            title="Что починили",
            add_fn=self._add_fix,
            remove_fn=self._remove_fix,
        )
        self._fixes_container = ctk.CTkFrame(fp, fg_color="transparent")
        self._fixes_container.grid(row=12, column=0, sticky="ew")

        ctk.CTkLabel(
            fp,
            text="Сохраняется в /updates/<YYYY-MM-DD>_v<version>_<slug>/",
            text_color="#6B7280",
            font=ctk.CTkFont(size=11),
        ).grid(row=13, column=0, sticky="w", padx=16, pady=(6, 20))

        # Начальные блоки (3+3 по умолчанию — заполнятся в _fill_defaults)
        for _ in range(3):
            self._add_feature(trigger_preview=False)
            self._add_fix(trigger_preview=False)

    def _build_section_header(self, row: int, title: str, add_fn, remove_fn) -> ctk.CTkFrame:
        frame = ctk.CTkFrame(self.form_panel, fg_color="transparent")
        frame.grid(row=row, column=0, sticky="ew", padx=16, pady=(14, 2))
        frame.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(frame, text=title, font=ctk.CTkFont(size=17, weight="bold")).grid(
            row=0, column=0, sticky="w"
        )

        btn_f = ctk.CTkFrame(frame, fg_color="transparent")
        btn_f.grid(row=0, column=1, sticky="e")
        ctk.CTkButton(btn_f, text="−", width=34, height=28, command=remove_fn).pack(side="left", padx=2)
        ctk.CTkButton(btn_f, text="+", width=34, height=28, command=add_fn).pack(side="left", padx=2)

        return frame

    def _add_entry(self, label: str, row: int) -> ctk.CTkEntry:
        frame = ctk.CTkFrame(self.form_panel)
        frame.grid(row=row, column=0, sticky="ew", padx=16, pady=5)
        frame.grid_columnconfigure(0, weight=1)

        ctk.CTkLabel(frame, text=label).grid(row=0, column=0, sticky="w", padx=12, pady=(10, 4))
        entry = ctk.CTkEntry(frame)
        entry.grid(row=1, column=0, sticky="ew", padx=12, pady=(0, 10))
        entry.bind("<KeyRelease>", self._on_field_change)
        return entry

    def _make_item_frame(self, container: ctk.CTkFrame, index: int, prefix: str) -> dict:
        frame = ctk.CTkFrame(container)
        frame.pack(fill="x", padx=16, pady=4)
        frame.grid_columnconfigure(0, weight=1)

        label = ctk.CTkLabel(frame, text=f"{prefix} #{index + 1}", font=ctk.CTkFont(weight="bold"))
        label.grid(row=0, column=0, sticky="w", padx=12, pady=(10, 4))

        title_entry = ctk.CTkEntry(frame, placeholder_text="Заголовок")
        title_entry.grid(row=1, column=0, sticky="ew", padx=12, pady=(0, 8))
        title_entry.bind("<KeyRelease>", self._on_field_change)

        text_box = ctk.CTkTextbox(frame, height=62, wrap="word")
        text_box.grid(row=2, column=0, sticky="ew", padx=12, pady=(0, 10))
        text_box.bind("<KeyRelease>", self._on_field_change)

        return {"frame": frame, "title": title_entry, "text": text_box, "label": label}

    # ──────────────────────────────────────────────────────────────────────────
    # Dynamic item blocks
    # ──────────────────────────────────────────────────────────────────────────

    def _add_feature(self, trigger_preview: bool = True) -> None:
        if len(self._feature_widgets) >= MAX_ITEMS:
            return
        w = self._make_item_frame(self._features_container, len(self._feature_widgets), "Добавили")
        self._feature_widgets.append(w)
        self._refresh_item_labels(self._feature_widgets, "Добавили")
        if trigger_preview:
            self._on_field_change()

    def _remove_feature(self) -> None:
        if len(self._feature_widgets) <= MIN_ITEMS:
            return
        w = self._feature_widgets.pop()
        w["frame"].pack_forget()
        w["frame"].destroy()
        self._on_field_change()

    def _add_fix(self, trigger_preview: bool = True) -> None:
        if len(self._fix_widgets) >= MAX_ITEMS:
            return
        w = self._make_item_frame(self._fixes_container, len(self._fix_widgets), "Починили")
        self._fix_widgets.append(w)
        self._refresh_item_labels(self._fix_widgets, "Починили")
        if trigger_preview:
            self._on_field_change()

    def _remove_fix(self) -> None:
        if len(self._fix_widgets) <= MIN_ITEMS:
            return
        w = self._fix_widgets.pop()
        w["frame"].pack_forget()
        w["frame"].destroy()
        self._on_field_change()

    def _refresh_item_labels(self, widgets: list[dict], prefix: str) -> None:
        for idx, w in enumerate(widgets):
            w["label"].configure(text=f"{prefix} #{idx + 1}")

    # ──────────────────────────────────────────────────────────────────────────
    # Format change
    # ──────────────────────────────────────────────────────────────────────────

    def _on_format_change(self, value: str) -> None:
        self._fmt = _FORMAT_MAP.get(value, "square")
        self._offsets.clear()
        self._on_field_change()

    # ──────────────────────────────────────────────────────────────────────────
    # Live preview (debounce 500 ms)
    # ──────────────────────────────────────────────────────────────────────────

    def _on_field_change(self, *_) -> None:
        if self._preview_job:
            self.after_cancel(self._preview_job)
        self._preview_job = self.after(500, lambda: self.on_preview(silent=True))

    # ──────────────────────────────────────────────────────────────────────────
    # Data collection
    # ──────────────────────────────────────────────────────────────────────────

    def _collect_payload(self) -> dict:
        return {
            "date":         self.date_entry.get().strip(),
            "version":      self.version_entry.get().strip(),
            "title_line_1": self.title_1_entry.get().strip(),
            "title_line_2": self.title_2_entry.get().strip(),
            "footer_left":  self.footer_left_entry.get().strip(),
            "footer_right": self.footer_right_entry.get().strip(),
            "features": [
                {
                    "title": w["title"].get().strip(),
                    "text":  w["text"].get("1.0", "end").strip(),
                }
                for w in self._feature_widgets
            ],
            "fixes": [
                {
                    "title": w["title"].get().strip(),
                    "text":  w["text"].get("1.0", "end").strip(),
                }
                for w in self._fix_widgets
            ],
        }

    def _fill_defaults(self) -> None:
        payload = default_payload()

        self.date_entry.insert(0, payload.date)
        self.version_entry.insert(0, payload.version)
        self.title_1_entry.insert(0, payload.title_line_1)
        self.title_2_entry.insert(0, payload.title_line_2)
        self.footer_left_entry.insert(0, payload.footer_left)
        self.footer_right_entry.insert(0, payload.footer_right)

        for idx, item in enumerate(payload.features):
            if idx < len(self._feature_widgets):
                self._feature_widgets[idx]["title"].insert(0, item.title)
                self._feature_widgets[idx]["text"].insert("1.0", item.text)

        for idx, item in enumerate(payload.fixes):
            if idx < len(self._fix_widgets):
                self._fix_widgets[idx]["title"].insert(0, item.title)
                self._fix_widgets[idx]["text"].insert("1.0", item.text)

    # ──────────────────────────────────────────────────────────────────────────
    # Render + display on canvas
    # ──────────────────────────────────────────────────────────────────────────

    def _render(self, payload: dict) -> tuple[Image.Image, BBoxes] | None:
        try:
            return render_update_image(payload, fmt=self._fmt, offsets=self._offsets)
        except Exception as exc:
            self.status_var.set(f"Ошибка рендера: {exc}")
            return None

    def _display_on_canvas(self, pil_image: Image.Image) -> None:
        cw = self._canvas.winfo_width()
        ch = self._canvas.winfo_height()
        if cw <= 1 or ch <= 1:
            return

        iw, ih = pil_image.size
        scale = min(cw / iw, ch / ih) * 0.97  # небольшой отступ по краям
        dw, dh = int(iw * scale), int(ih * scale)

        self._canvas_scale = scale
        ox = (cw - dw) // 2
        oy = (ch - dh) // 2
        self._canvas_img_offset = (ox, oy)

        resized = pil_image.resize((dw, dh), Image.Resampling.LANCZOS)
        self._canvas_photo = ImageTk.PhotoImage(resized)

        self._canvas.delete("all")
        self._canvas.create_image(ox, oy, anchor="nw", image=self._canvas_photo)

        # Рисуем overlay-зоны для drag-редактора
        self._overlay_ids = {}
        for name, (x0, y0, x1, y1) in self._bboxes.items():
            cx0 = ox + x0 * scale
            cy0 = oy + y0 * scale
            cx1 = ox + x1 * scale
            cy1 = oy + y1 * scale
            color = "#CCFF00" if name == self._selected_elem else "#3A3A3A"
            width = 2 if name == self._selected_elem else 1
            rid = self._canvas.create_rectangle(
                cx0, cy0, cx1, cy1,
                outline=color, fill="", width=width, dash=(5, 3),
            )
            self._overlay_ids[name] = rid

    def _highlight_selected(self) -> None:
        for name, rid in self._overlay_ids.items():
            color = "#CCFF00" if name == self._selected_elem else "#3A3A3A"
            width = 2 if name == self._selected_elem else 1
            self._canvas.itemconfig(rid, outline=color, width=width)

    def _on_canvas_resize(self, *_) -> None:
        if self._last_rendered is not None:
            self._display_on_canvas(self._last_rendered)

    # ──────────────────────────────────────────────────────────────────────────
    # Canvas drag editor
    # ──────────────────────────────────────────────────────────────────────────

    def _canvas_to_image(self, cx: int, cy: int) -> tuple[float, float]:
        ox, oy = self._canvas_img_offset
        return (cx - ox) / self._canvas_scale, (cy - oy) / self._canvas_scale

    def _hit_test(self, ix: float, iy: float) -> str | None:
        for name, (x0, y0, x1, y1) in self._bboxes.items():
            if x0 <= ix <= x1 and y0 <= iy <= y1:
                return name
        return None

    def _on_canvas_press(self, event: tk.Event) -> None:
        ix, iy = self._canvas_to_image(event.x, event.y)
        hit = self._hit_test(ix, iy)
        self._selected_elem = hit
        if hit:
            self._drag_start_canvas = (event.x, event.y)
            self._drag_start_offset = self._offsets.get(hit, (0, 0))
            self._canvas.config(cursor="fleur")
        else:
            self._drag_start_canvas = None
            self._canvas.config(cursor="")
        self._highlight_selected()

        if hit:
            dx, dy = self._offsets.get(hit, (0, 0))
            self._drag_info_var.set(f"Выбрано: [{hit}]  смещение ({dx:+d}, {dy:+d})")
        else:
            self._drag_info_var.set("Кликните на зону в превью — перетащите для смещения")

    def _on_canvas_drag(self, event: tk.Event) -> None:
        if self._selected_elem is None or self._drag_start_canvas is None:
            return

        dcx = event.x - self._drag_start_canvas[0]
        dcy = event.y - self._drag_start_canvas[1]

        # Смещение в пикселях изображения
        base_dx, base_dy = self._drag_start_offset
        new_dx = base_dx + int(dcx / self._canvas_scale)
        new_dy = base_dy + int(dcy / self._canvas_scale)
        self._offsets[self._selected_elem] = (new_dx, new_dy)

        # Двигаем overlay-прямоугольник в реальном времени (без ре-рендера)
        rid = self._overlay_ids.get(self._selected_elem)
        if rid is not None:
            ox, oy = self._canvas_img_offset
            x0, y0, x1, y1 = self._bboxes[self._selected_elem]
            s = self._canvas_scale
            # Базовая позиция rect (с учётом drag_start_offset)
            b_dx, b_dy = self._drag_start_offset
            ncx0 = ox + (x0 + b_dx) * s + dcx
            ncy0 = oy + (y0 + b_dy) * s + dcy
            ncx1 = ncx0 + (x1 - x0) * s
            ncy1 = ncy0 + (y1 - y0) * s
            self._canvas.coords(rid, ncx0, ncy0, ncx1, ncy1)

        self._drag_info_var.set(f"Выбрано: [{self._selected_elem}]  смещение ({new_dx:+d}, {new_dy:+d})")

    def _on_canvas_release(self, *_) -> None:
        if self._selected_elem is not None and self._drag_start_canvas is not None:
            # Ре-рендер с новыми смещениями
            payload = self._collect_payload()
            result = self._render(payload)
            if result:
                self._last_rendered, self._bboxes = result
                self._display_on_canvas(self._last_rendered)
                self._highlight_selected()
        self._drag_start_canvas = None

    def _on_canvas_hover(self, event: tk.Event) -> None:
        if self._selected_elem is not None:
            return  # курсор уже управляется drag'ом
        ix, iy = self._canvas_to_image(event.x, event.y)
        over = self._hit_test(ix, iy)
        self._canvas.config(cursor="hand2" if over else "")

    def _reset_offsets(self) -> None:
        self._offsets.clear()
        self._selected_elem = None
        self._drag_info_var.set("Позиции сброшены")
        self.on_preview(silent=True)

    # ──────────────────────────────────────────────────────────────────────────
    # Preview / Save
    # ──────────────────────────────────────────────────────────────────────────

    def on_preview(self, silent: bool = False) -> None:
        payload = self._collect_payload()
        errors = validate_payload(payload)
        if errors:
            self.status_var.set(errors[0])
            if not silent:
                messagebox.showerror("Ошибка валидации", "\n".join(errors))
            return

        result = self._render(payload)
        if not result:
            return
        self._last_rendered, self._bboxes = result

        self.update_idletasks()
        if self._canvas.winfo_width() <= 1:
            self.after(120, lambda: self._display_on_canvas(self._last_rendered))
        else:
            self._display_on_canvas(self._last_rendered)

        fmt_label = self._fmt_var.get()
        size_str = {"1:1  Квадрат": "1080×1080", "9:16  Сторис": "1080×1920", "16:9  Баннер": "1920×1080"}.get(fmt_label, "")
        self.status_var.set(f"Превью обновлено  —  {size_str}")

    def on_save(self) -> None:
        payload = self._collect_payload()
        errors = validate_payload(payload)
        if errors:
            self.status_var.set(errors[0])
            messagebox.showerror("Ошибка валидации", "\n".join(errors))
            return

        result = self._render(payload)
        if not result:
            return
        image, bboxes = result
        self._last_rendered = image
        self._bboxes = bboxes

        try:
            update_dir = save_update(payload, image, project_root=self.project_root)
        except ValueError as error:
            messagebox.showerror("Ошибка сохранения", str(error))
            return

        self.status_var.set(f"Сохранено: {update_dir}")
        messagebox.showinfo("Сохранено", f"Файлы созданы:\n{update_dir}")


def main() -> None:
    app = PillowUpdateDesktopApp()
    app.mainloop()


if __name__ == "__main__":
    main()
