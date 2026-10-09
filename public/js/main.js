"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // Load services on homepage
  const servicesContainer = document.getElementById("services-container");
  if (servicesContainer) {
    fetch("/api/services")
      .then(res => res.json())
      .then(services => {
        if (!Array.isArray(services) || services.length === 0) {
          servicesContainer.innerHTML = "<p style=\"color: var(--text-muted);\">No repair services available at the moment.</p>";
          return;
        }

        servicesContainer.innerHTML = services.map(service => `
          <div class="service-card">
            <div>
              <div class="service-header">
                <h4 class="service-title">${service.name}</h4>
                <div class="service-price">₱${Number(service.price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</div>
              </div>
              <p class="service-desc">${service.description}</p>
            </div>
            <a href="/booking.html?service=${service.id}" class="btn btn-blue" style="width: 100%;">Book This Service</a>
          </div>
        `).join("");
      })
      .catch(err => {
        console.error("Error loading services:", err);
        servicesContainer.innerHTML = "<p style=\"color: #fca5a5;\">Failed to load services. Please try again later.</p>";
      });
  }

  // Pre-select service on booking page if passed in query param
  const serviceSelect = document.getElementById("service_id");
  if (serviceSelect) {
    fetch("/api/services")
      .then(res => res.json())
      .then(services => {
        if (Array.isArray(services)) {
          serviceSelect.innerHTML = "<option value=\"\">-- Choose a service --</option>" + services.map(s => `
            <option value="${s.id}">${s.name} (₱${Number(s.price).toLocaleString("en-PH", { minimumFractionDigits: 2 })})</option>
          `).join("");

          const urlParams = new URLSearchParams(window.location.search);
          const serviceId = urlParams.get("service");
          if (serviceId) {
            serviceSelect.value = serviceId;
          }
        }
      })
      .catch(err => console.error("Error loading services for dropdown:", err));
  }

  // Handle booking form submission
  const bookingForm = document.getElementById("booking-form");
  if (bookingForm) {
    bookingForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const alertBox = document.getElementById("alert-box");
      alertBox.style.display = "none";

      const formData = {
        service_id: document.getElementById("service_id").value,
        name: document.getElementById("name").value.trim(),
        contact: document.getElementById("contact").value.trim(),
        email: document.getElementById("email").value.trim(),
        booking_date: document.getElementById("booking_date").value,
        booking_time: document.getElementById("booking_time").value,
        guests: document.getElementById("guests").value,
        notes: document.getElementById("notes").value.trim()
      };

      try {
        const res = await fetch("/api/bookings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData)
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Failed to submit booking");
        }

        // Redirect to confirmation page with reference
        window.location.href = `/confirmation.html?ref=${data.booking.reference}`;
      } catch (err) {
        alertBox.textContent = err.message;
        alertBox.className = "alert alert-error";
        alertBox.style.display = "block";
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });
  }
});
