"use strict";

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");
const bcrypt = require("bcryptjs");

async function createAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!supabaseUrl || !supabaseKey || !username || !password) {
    console.error("Error: Missing environment variables. Please check SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_USERNAME, and ADMIN_PASSWORD.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const { data, error } = await supabase
      .from("admins")
      .insert([
        {
          username: username,
          password_hash: passwordHash
        }
      ]);

    if (error) {
      if (error.code === "23505") {
        console.log(`Admin user "${username}" already exists.`);
      } else {
        throw error;
      }
    } else {
      console.log(`Admin user "${username}" created successfully.`);
    }
  } catch (err) {
    console.error("Error creating admin:", err.message);
    process.exit(1);
  }
}

createAdmin();
