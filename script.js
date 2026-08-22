function showMessage(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.style.display = "none", 2800);
}

function filterItems(category, button) {
  document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
  button.classList.add("active");
  document.querySelectorAll(".product").forEach(card => {
    card.style.display = category === "All" || card.dataset.category === category ? "block" : "none";
  });
}

function selectVendor(vendor, button) {
  document.querySelectorAll(".vendor").forEach(b => b.classList.remove("active"));
  button.classList.add("active");
  document.getElementById("vendorTitle").textContent = vendor + " Menu";
  showMessage("Showing " + vendor + ".");
}

function addFood(item) {
  showMessage(item + " added to your cart.");
}
