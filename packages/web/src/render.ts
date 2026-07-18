export function htmlPage(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #313338; color: #f2f3f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    main { background: #2b2d31; padding: 2.5rem; border-radius: 12px; max-width: 420px; text-align: center; }
    h1 { font-size: 1.4rem; margin-bottom: 0.75rem; }
    p { color: #b5bac1; line-height: 1.5; }
    .button { display: inline-block; margin-top: 1rem; background: #5865f2; color: white; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 8px; font-weight: 600; }
    .button:hover { background: #4752c4; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    ${bodyHtml}
  </main>
</body>
</html>`;
}
