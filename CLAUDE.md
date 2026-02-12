# CampusApp - Developer Guide (2026 Updated)

## 🛠 Tech Stack
- **Frontend:** React 18, Zustand, Telegram Mini Apps SDK.
- **Backend:** FastAPI, SQLAlchemy (Async), PostgreSQL (Docker).
- **Driver:** `asyncpg` (Required!).
- **Design:** CSS Modules / Styled. ONLY use `src/theme.js`.
- **Environment:** Windows 11, Python 3.11+, Node.js.

## 🐳 Infrastructure (Docker)
- **Database:** PostgreSQL container.
- **Check Status:** `docker ps --filter "name=postgres"`
- **Connection:** `postgresql+asyncpg://user:pass@localhost:5432/dbname` (Load from .env)
- **Migrations:** Auto-create via SQLAlchemy engine (Development mode).

## 🏗 Architecture Rules
1.  **Single Source of Truth:** Backend API. Frontend is a view layer.
2.  **Shared Components (MANDATORY):**
    -   CHECK `frontend/src/components/shared/` FIRST.
    -   Toast -> `src/components/shared/Toast.js` (NO alert/console.log in prod).
    -   Dialogs -> `src/components/shared/ConfirmationDialog.js`.
    -   Icons/Media -> `src/components/shared/PhotoViewer.js`.
3.  **Performance:**
    -   Animations: `transform` / `opacity` only.
    -   Lists: `React.memo` + `useCallback`.
    -   Backend: Avoid N+1 (use `selectinload`).

## 🚨 Anti-Patterns (Strictly Forbidden)
-   Writing raw SQL strings (Use ORM).
-   Direct state mutation in React.
-   Ignoring `window.Telegram.WebApp` checks.
-   Hardcoding colors (Use `theme.colors`).

## 📝 Code Format
-   **Header:** `// ===== 📄 FILE: Component.js =====`
-   **Comments:** Russian (complex logic only).
-   **Changes:** Do not remove existing functionality without approval.