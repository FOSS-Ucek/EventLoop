const prisma = require("../config/prisma");
const { isValidObjectId } = require("../utils/validation");

// 1. Get All Users (Admin Panel)
const getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, users });
  } catch (error) {
    console.error("❌ Get users error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch users from database" });
  }
};

// 2. Get Single User (by ID or Email)
const getUser = async (req, res) => {
  const { id, email } = req.query;

  try {
    let user = null;
    if (id && isValidObjectId(id)) {
      user = await prisma.user.findUnique({ where: { id } });
    }
    if (!user && email) {
      user = await prisma.user.findUnique({ where: { email } });
    }

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("❌ Get user error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch user record" });
  }
};

// 3. Sync / Upsert Google User (NextAuth callback hook)
const upsertUser = async (req, res) => {
  const { email, name, image } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: "Email is required" });
  }

  try {
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name,
          image,
          role: "user",
        },
      });
      console.log(`Registered new user: ${email}`);
    } else {
      console.log(`Logged in existing user: ${email}`);
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error("❌ Upsert user error:", error);
    res.status(500).json({ success: false, error: "Internal Database Sync Error" });
  }
};

// 4. Update User Profile Settings (Name, Base64 Image, and Testing Roles)
const updateUser = async (req, res) => {
  const { id, email, name, image, role } = req.body;

  if (!id && !email) {
    return res.status(400).json({ success: false, error: "User ID ('id') or 'email' is required" });
  }

  try {
    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (image !== undefined) updateData.image = image;
    if (role !== undefined && (role === "admin" || role === "user")) {
      updateData.role = role;
    }

    const whereClause = id && isValidObjectId(id) ? { id } : email ? { email } : null;

    if (!whereClause) {
      return res.status(400).json({ success: false, error: "Valid MongoDB ObjectId or Email is required" });
    }

    const updatedUser = await prisma.user.update({
      where: whereClause,
      data: updateData,
    });

    console.log(`Updated profile for user:`, whereClause);
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("❌ Update user error:", error);
    res.status(500).json({ success: false, error: "Failed to update user profile in database" });
  }
};

module.exports = {
  getUsers,
  getUser,
  upsertUser,
  updateUser,
};
