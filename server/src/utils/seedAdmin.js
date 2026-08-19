import "dotenv/config";
import mongoose from "mongoose";
import User from "../models/User.js";

const seedAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const adminEmail = "admin@kalyanchemist.in";

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log(`Admin user already exists: ${adminEmail}`);
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      name: "Kalyan Admin",
      email: adminEmail,
      password: "Admin@123456",
      phone: "+919876543210",
      role: "admin",
      isActive: true,
    });

    console.log("\n✅ Admin user created successfully!");
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: Admin@123456`);
    console.log(`   Role: ${admin.role}`);
    console.log("\n⚠️  Change this password after first login!\n");

    process.exit(0);
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exit(1);
  }
};

seedAdmin();
