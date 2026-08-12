# YT Video Downloader Frontend

This is the React + TypeScript frontend for the YT Video Downloader. It connects to the FastAPI backend to query media metadata, manage local download history, and download files directly to the server's `Downloads` folder, showing real-time progress updates over WebSockets.

## Tech Stack
- **Bundler**: Vite
- **UI Framework**: React 19 + TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: shadcn/ui (powered by `@base-ui/react`)
- **Icons**: Lucide React

---

## Getting Started

### Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 1. Environment Configuration
Copy the template `.env.example` file to create your local environment file:
```bash
cp .env.example .env
```
Inside `.env`, verify that the backend API URL matches your running server:
```env
VITE_API_BASE_URL=http://localhost:8000
```
*Note: The application will automatically derive the correct WebSocket address (e.g. `ws://localhost:8000`) from this HTTP URL.*

### 2. Installation
Install all dependency packages:
```bash
npm install
```

### 3. Run Development Server
Start the local server with hot-module reloading:
```bash
npm run dev
```
Open your browser and navigate to the local URL (typically `http://localhost:5173`).

### 4. Build for Production
To bundle the frontend for production:
```bash
npm run build
```
This builds static assets into the `dist/` directory.

---

## Project Structure
- `src/App.tsx`: Main dashboard coordinator. Handles API resolution, download configuration, download monitor lifecycle, history modal management, and redownload triggers.
- `src/hooks/useDownloadHistory.ts`: Custom hook managing local history state, API communication, and automatic background refresh.
- `src/types/history.ts`: TypeScript schemas for history sessions, file items, and status states.
- `src/components/RecentDownloads.tsx`: Homepage widget displaying the 5 most recent download sessions.
- `src/components/DownloadHistoryDialog.tsx`: Full history modal dialog with search/list, per-entry details view, deletion, and clear history confirmation.
- `src/components/HistoryEntry.tsx`: History item card component displaying media type, format, resolution, counts, date, and quick actions (`Details`, `Redownload`, `Delete`).
- `src/components/HistoryDetails.tsx`: Detailed view panel showing metadata, original source URL, saved location (`Downloads/`), and per-file completion status/errors.
- `src/components/DownloadStatusBadge.tsx`: Accessible status indicator badge (`completed`, `partial`, `failed`).
- `src/components/ui/`: Extracted and themed UI components (Button, Input, Card, Checkbox, Dialog, Progress, Select, Tabs, Badge).
- `src/lib/api.ts`: API client functions for resolve, download, and history REST endpoints.
- `src/lib/utils.ts`: Tailwind CSS class-merging helper (`cn`).
- `src/index.css`: Styling core containing design system variables under Tailwind CSS v4.
