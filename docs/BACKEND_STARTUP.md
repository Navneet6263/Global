# Backend startup on Windows

Run these commands from `TrustLink-Verifications/backend`.

For development, use one terminal and leave it open:

```cmd
npm run dev
```

This cleans generated output, compiles the backend and watches source changes.
`npm run start:dev` is the equivalent command. Do not run both simultaneously.

To run a prebuilt backend instead:

```cmd
npm run build
npm start
```

`npm start` does not compile source. If a build failed or `dist` was removed,
`dist/main.js` will not exist until a successful build completes.

## Generated-output cleanup

Nest's single-attempt directory removal is disabled in `nest-cli.json`.
The npm `prebuild`, `predev`, `prestart:dev` and `prestart:e2e` hooks instead run
`scripts/clean-build.mjs`. Use these npm commands rather than invoking Nest directly
when a clean build is needed.

The cleaner targets only `backend/dist`, refuses directory links and requests six
bounded retries for transient Windows locks. Persistent failures stop startup with
an actionable message; they are not silently ignored. The TypeScript build cache
lives inside `dist`, so cleanup removes it together with compiled JavaScript.
No source files, uploaded documents or database records are targeted.

If cleanup still reports `EPERM`, close another backend watch/build or a terminal
whose current directory is inside `dist`. Check local file access/antivirus if the
lock persists; do not kill all Node processes or disable security software globally.

Run `npm run test:build` to verify the cleanup targets, retry settings, failure
handling and npm hook configuration without deleting real test files.
