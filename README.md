# EchoesLauncher

An unofficial launcher for Vintage Story. The project is being prepared for continued development.

## Development

```sh
npm install
npm run dev
```

Work and testing happen on `dev`. The `main` branch is reserved for stable releases.

## Before publishing

- Copy `.env.example` to `.env` and set any additional project links when they are ready.
- Set the update feed in `src/config/project.ts` when releases are ready.
- Replace the temporary application icons and complete the documentation.
- Review package identifiers and release targets in `electron-builder.yml`.

See [LICENSE](LICENSE) for the license and required attribution.
