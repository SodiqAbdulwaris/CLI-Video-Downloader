export function Footer() {
  return (
    <footer className="flex flex-col sm:flex-row items-center justify-between gap-3 py-8 mt-6 border-t border-border/40 text-xs text-muted-foreground">
      <p>YT Video Downloader — S.A.</p>

      <a
        href="https://github.com/SodiqAbdulwaris/CLI-Video-Downloader"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-foreground transition-colors"
      >
        GitHub
      </a>
    </footer>
  );
}
