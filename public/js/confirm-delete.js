document.addEventListener("submit", (event) => {
  const form = event.target;

  if (!(form instanceof HTMLFormElement)) return;

  const action = form.getAttribute("action") || "";

  if (!action.includes("/delete")) return;

  const message =
    form.dataset.confirmMessage ||
    "정말 삭제하시겠습니까? 삭제한 내용은 복구할 수 없습니다.";

  const confirmed = window.confirm(message);

  if (!confirmed) {
    event.preventDefault();
  }
});