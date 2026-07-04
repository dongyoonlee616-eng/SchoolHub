document.addEventListener("submit", (event) => {
  const form = event.target;

  if (!(form instanceof HTMLFormElement)) {
    return;
  }

  // 검색 폼처럼 여러 번 제출해도 되는 폼은 제외 가능
  if (form.dataset.allowMultipleSubmit === "true") {
    return;
  }

  // 이미 제출된 폼이면 다시 제출 막기
  if (form.dataset.submitted === "true") {
    event.preventDefault();
    return;
  }

  form.dataset.submitted = "true";

  const submitButtons = form.querySelectorAll(
    'button[type="submit"], input[type="submit"]'
  );

  submitButtons.forEach((button) => {
    button.disabled = true;

    if (button.tagName === "BUTTON") {
      button.dataset.originalText = button.textContent;
      button.textContent = button.dataset.loadingText || "처리 중...";
    }

    if (button.tagName === "INPUT") {
      button.dataset.originalValue = button.value;
      button.value = button.dataset.loadingText || "처리 중...";
    }
  });
});