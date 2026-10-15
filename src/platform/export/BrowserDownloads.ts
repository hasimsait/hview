export class BrowserDownloads {
  save(content: string, mimeType: string, filename: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const link = document.createElement('a');
    try {
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click();
    } finally {
      link.remove();
      // Safari may consume the download after the click handler has returned.
      const timer = setTimeout(() => URL.revokeObjectURL(url), 60_000) as ReturnType<typeof setTimeout> & { unref?: () => void };
      timer.unref?.();
    }
  }
}
