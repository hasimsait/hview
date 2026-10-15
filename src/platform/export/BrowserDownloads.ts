export class BrowserDownloads {
  save(content: string, mimeType: string, filename: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
    const link = document.createElement('a');
    try {
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click();
    } finally { link.remove(); URL.revokeObjectURL(url); }
  }
}
