// Client-only. Removes the background from a product photo in the browser (WASM),
// producing a transparent PNG. Falls back to the original file if removal fails
// (unsupported browser, model fetch failure, etc.) so upload never breaks.
export async function removeBg(file: File): Promise<File> {
  try {
    const { removeBackground } = await import('@imgly/background-removal');
    const blob = await removeBackground(file);
    return new File([blob], 'nobg.png', { type: 'image/png' });
  } catch {
    return file;
  }
}
