"use strict";

document.addEventListener("DOMContentLoaded", async () => {
  const alertBox = document.getElementById("alert-box");
  const adminWelcome = document.getElementById("admin-welcome");
  const bookingsTbody = document.getElementById("bookings-tbody");
  const logoutBtn = document.getElementById("logout-btn");
  const refreshBtn = document.getElementById("refresh-btn");

  // Check authentication status
  try {
    const authRes = await fetch("/api/admin/check");
    if (!authRes.ok) {
      window.location.href = "/admin/login.html";
      return;
    }
    const authData = await authRes.json();
    if (authData.admin && authData.admin.username) {
      adminWelcome.textContent = `Logged in as: ${authData.admin.username}`;
    }
  } catch (err) {
    window.location.href = "/admin/login.html";
    return;
  }

  // Function to fetch and render bookings
  async function loadBookings() {
    try {
      bookingsTbody.innerHTML = "<tr><td colspan=\"9\" style=\"text-align: center; color: var(--text-muted);\">Loading bookings...</td></tr>";
      
      const res = await fetch("/api/admin/bookings");
      if (!res.ok) {
        throw new Error("Failed to fetch bookings");
      }

      const bookings = await res.json();

      if (!Array.isArray(bookings) || bookings.length === 0) {
        bookingsTbody.innerHTML = "<tr><td colspan=\"9\" style=\"text-align: center; color: var(--text-muted);\">No bookings found.</td></tr>";
        return;
      }

      bookingsTbody.innerHTML = bookings.map(b => `
        <tr>
          <td><strong style="color: var(--accent-green);">${b.reference}</strong></td>
          <td>${b.services ? b.services.name : 'N/A'}</td>
          <td>${b.name}</td>
          <td>${b.contact}<br><small style="color: var(--text-muted);">${b.email}</small></td>
          <td>${b.booking_date}<br><small style="color: var(--text-muted);">${b.booking_time}</small></td>
          <td>${b.guests}</td>
          <td>${b.notes || '<span style="color: var(--text-muted);">-</span>'}</td>
          <td><span class="badge badge-${b.status}">${b.status}</span></td>
          <td>
            <div class="action-btns">
              ${b.status !== 'confirmed' ? `<button class="btn btn-sm" onclick="updateStatus(${b.id}, 'confirmed')">Confirm</button>` : ''}
              ${b.status !== 'cancelled' ? `<button class="btn btn-outline btn-sm" style="color: #fca5a5; border-color: #fca5a5;" onclick="updateStatus(${b.id}, 'cancelled')">Cancel</button>` : ''}
              <button class="btn btn-outline btn-sm" style="color: #ef4444; border-color: #ef4444;" onclick="deleteBooking(${b.id})">Delete</button>
            </div>
          </td>
        </tr>
      `).join("");
    } catch (err) {
      showAlert(err.message, "error");
      bookingsTbody.innerHTML = "<tr><td colspan=\"9\" style=\"text-align: center; color: #fca5a5;\">Failed to load bookings.</td></tr>";
    }
  }

  // Global functions for inline event handlers
  window.updateStatus = async (id, status) => {
    try {
      const res = await fetch(`/api/admin/bookings/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      showAlert(data.message, "success");
      loadBookings();
    } catch (err) {
      showAlert(err.message, "error");
    }
  };

  window.deleteBooking = async (id) => {
    if (!confirm("Are you sure you want to delete this booking? This action cannot be undone.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/bookings/${id}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete booking");

      showAlert(data.message, "success");
      loadBookings();
    } catch (err) {
      showAlert(err.message, "error");
    }
  };

  function showAlert(message, type) {
    alertBox.textContent = message;
    alertBox.className = `alert alert-${type === 'success' ? 'success' : 'error'}`;
    alertBox.style.display = "block";
    setTimeout(() => {
      alertBox.style.display = "none";
    }, 4000);
  }

  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      window.location.href = "/admin/login.html";
    } catch (err) {
      console.error("Logout error:", err);
    }
  });

  refreshBtn.addEventListener("click", loadBookings);

  // Initial load
  loadBookings();
});
