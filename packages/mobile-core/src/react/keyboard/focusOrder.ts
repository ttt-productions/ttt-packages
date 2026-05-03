export function getFocusableInputs(root: HTMLElement | Document = document) {
  const el = root instanceof Document ? root : root;
  const list = Array.from(
    el.querySelectorAll<HTMLElement>(
      'input, textarea, select, [contenteditable="true"], [data-ttt-input]'
    )
  ).filter((n) => !n.hasAttribute("disabled") && n.tabIndex !== -1);

  // DOM order is usually correct; allow explicit override
  list.sort((a, b) => {
    const ao = Number(a.getAttribute("data-input-order") ?? "0");
    const bo = Number(b.getAttribute("data-input-order") ?? "0");
    if (ao && bo) return ao - bo;
    if (ao) return -1;
    if (bo) return 1;
    return 0;
  });

  return list;
}
