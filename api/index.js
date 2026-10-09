"use strict";

const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { createClient } = require("@supabase/supabase-js");
const path = require("path");

require("dotenv").config();

const app = express();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_change_me";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn("Warning: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.");
}

const supabase = createClient(SUPABASE_URL || "", SUPABASE_SERVICE_ROLE_KEY || "");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "..", "public")));

// Helper to generate a unique reference number
function generateReference() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "IT-";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Middleware to verify admin JWT from cookie
function verifyAdmin(req, res, next) {
  const token = req.cookies.admin_token;
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
}

// ==================== VISITOR API ROUTES ====================

// Get all active services
app.get("/api/services", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("services")
      .select("*")
      .eq("is_active", true)
      .order("id", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Error fetching services:", err.message);
    res.status(500).json({ error: "Failed to fetch services" });
  }
});

// Create a new booking
app.post("/api/bookings", async (req, res) => {
  try {
    const { service_id, name, contact, email, booking_date, booking_time, guests, notes } = req.body;

    if (!service_id || !name || !contact || !email || !booking_date || !booking_time) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let reference = generateReference();
    let isUnique = false;
    let attempts = 0;

    // Ensure unique reference
    while (!isUnique && attempts < 5) {
      const { data: existing } = await supabase
        .from("bookings")
        .select("id")
        .eq("reference", reference)
        .single();

      if (!existing) {
        isUnique = true;
      } else {
        reference = generateReference();
        attempts++;
      }
    }

    const { data, error } = await supabase
      .from("bookings")
      .insert([
        {
          reference,
          service_id,
          name,
          contact,
          email,
          booking_date,
          booking_time,
          guests: guests ? parseInt(guests, 10) : 1,
          notes: notes || "",
          status: "pending"
        }
      ])
      .select("*, services(name, price)")
      .single();

    if (error) throw error;

    res.status(201).json({
      message: "Booking submitted successfully",
      booking: data
    });
  } catch (err) {
    console.error("Error creating booking:", err.message);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// Get booking details by reference number
app.get("/api/bookings/lookup/:reference", async (req, res) => {
  try {
    const { reference } = req.params;

    const { data, error } = await supabase
      .from("bookings")
      .select("*, services(name, description, price)")
      .eq("reference", reference.toUpperCase())
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Booking not found with this reference number" });
    }

    res.json(data);
  } catch (err) {
    console.error("Error looking up booking:", err.message);
    res.status(500).json({ error: "Failed to lookup booking" });
  }
});

// ==================== ADMIN API ROUTES ====================

// Admin login
app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    const { data: admin, error } = await supabase
      .from("admins")
      .select("*")
      .eq("username", username)
      .single();

    if (error || !admin) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.cookie("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 8 * 60 * 60 * 1000 // 8 hours
    });

    res.json({ message: "Login successful", username: admin.username });
  } catch (err) {
    console.error("Admin login error:", err.message);
    res.status(500).json({ error: "Internal server error during login" });
  }
});

// Admin logout
app.post("/api/admin/logout", (req, res) => {
  res.clearCookie("admin_token");
  res.json({ message: "Logged out successfully" });
});

// Check admin auth status
app.get("/api/admin/check", verifyAdmin, (req, res) => {
  res.json({ authenticated: true, admin: req.admin });
});

// Get all bookings (Admin)
app.get("/api/admin/bookings", verifyAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("bookings")
      .select("*, services(name, price)")
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("Error fetching admin bookings:", err.message);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// Update booking status (Confirm or Cancel) (Admin)
app.patch("/api/admin/bookings/:id/status", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["pending", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status value" });
    }

    const { data, error } = await supabase
      .from("bookings")
      .update({ status })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: `Booking status updated to ${status}`, booking: data });
  } catch (err) {
    console.error("Error updating booking status:", err.message);
    res.status(500).json({ error: "Failed to update booking status" });
  }
});

// Delete booking (Admin)
app.delete("/api/admin/bookings/:id", verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("bookings")
      .delete()
      .eq("id", id);

    if (error) throw error;

    res.json({ message: "Booking deleted successfully" });
  } catch (err) {
    console.error("Error deleting booking:", err.message);
    res.status(500).json({ error: "Failed to delete booking" });
  }
});

// For local testing
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
