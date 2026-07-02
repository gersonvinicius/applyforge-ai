function injectPrintBehavior(html: string, title: string): string {
  const documentTitle = title.trim() || 'ApplyForge CV';
  const titleTag = `<title>${documentTitle.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</title>`;
  const script = `
    <script>
      window.addEventListener('load', function () {
        window.setTimeout(function () {
          window.focus();
          window.print();
        }, 250);
      });

      window.addEventListener('afterprint', function () {
        window.setTimeout(function () {
          window.close();
        }, 150);
      });
    </script>
  `;

  const withTitle = /<title[\s\S]*?<\/title>/i.test(html)
    ? html.replace(/<title[\s\S]*?<\/title>/i, titleTag)
    : html.replace('</head>', `${titleTag}</head>`);

  return withTitle.includes('</body>')
    ? withTitle.replace('</body>', `${script}</body>`)
    : `${withTitle}${script}`;
}

export function openPrintWindow(html: string, title: string): void {
  const popup = window.open('', '_blank');

  if (!popup) {
    throw new Error('O navegador bloqueou a janela de impressao. Libere pop-ups para este app.');
  }

  popup.document.open();
  popup.document.write(injectPrintBehavior(html, title));
  popup.document.close();
}
