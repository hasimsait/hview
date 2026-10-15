export function validateDocumentJson(json: string): void {
  const value = JSON.parse(json);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Plan JSON must be an object');
}
