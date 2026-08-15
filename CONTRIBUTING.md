# Contributing

Thanks for considering a contribution. This project is small and has no formal process; the short version is fork it, make your change, verify it, and open a pull request against `main`.

## Getting set up

Follow Installation in the README to install both the backend and frontend, and Usage to run them locally. There's nothing beyond that: no separate contributor environment or config.

## Before opening a pull request

Run the checks the project actually has:

```bash
cd frontend
npm run build
npm run lint
```

If you changed backend code, actually run the app (CLI, web app, or both, whichever your change touches) and confirm the change does what you intended. There's no backend test suite yet; manual verification is the current bar.

## Making a change

- Keep pull requests focused. One change, one PR, is easier to review than several unrelated fixes bundled together.
- Match the existing code style in the file you're editing rather than introducing a new pattern.
- If your change affects setup, usage, configuration, or anything else the README documents, update the README in the same PR. A README that describes behavior the code no longer has is worse than no documentation.
- Don't add features outside what the project already does (see Features in the README) without opening an issue to discuss it first. This project intentionally stays small.

## Reporting bugs

Open an issue with the URL or type of video that failed (if applicable), what you expected, what happened instead, and whether you're running natively or through Docker. Logs from the terminal running the backend, or `docker compose logs backend`, are usually the most useful thing you can include.

## Project structure

See Project Structure and Architecture in the README before making a non-trivial change; they explain where the download engine, the two interfaces built on it, and the persistence layer each live.
