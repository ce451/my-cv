/** the address is in the HTML only base64-encoded (as content/cv.de.json has it), so harvesters miss it */
export function revealMail() {
  for (const a of document.querySelectorAll<HTMLAnchorElement>('a[data-mail]')) {
    try {
      const address = atob(a.dataset.mail!);
      a.href = `mailto:${address}`;
      a.textContent = address;
    } catch {
      // keep the placeholder
    }
  }
}
