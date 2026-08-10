# YT Video Downloader Frontend

This is the React + TypeScript frontend for the YT Video Downloader. It connects to the FastAPI backend to query media metadata and download files directly to the server's `Downloads` folder, showing real-time progress updates over WebSockets.

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
- `src/App.tsx`: Main dashboard coordinator. Handles API resolution, selection forms, and WebSocket listeners.
- `src/components/ui/`: Extracted and themed UI components (Button, Input, Card, Checkbox, Progress, Select, Tabs, Badge).
- `src/lib/utils.ts`: Tailwind CSS class-merging helper (`cn`).
- `src/index.css`: Styling core containing the deep indigo design system variables under Tailwind CSS v4.
