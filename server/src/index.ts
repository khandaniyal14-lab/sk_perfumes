import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import jwt, { type JwtPayload } from "jsonwebtoken";
import multer from "multer";
import { prisma } from "./lib/prisma.js";

const app = express();
const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET;
const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");
const UPLOAD_DIR = path.join(UPLOAD_ROOT, "perfumes");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error("Set JWT_SECRET to a random secret of at least 32 characters in .env");
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:5173",
}));
app.use(express.json({ limit: "1mb" }));
app.use("/uploads", express.static(UPLOAD_ROOT));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname || "");
      const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;
      cb(null, safeName);
    },
  }),
  limits: {
    files: 5,
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }

    cb(new Error("Only image files are allowed."));
  },
});

type AuthRequest = Request & { adminId?: number };

function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ")
    ? header.slice(7)
    : undefined;

  if (!token) {
    res.status(401).json({ message: "Authentication required." });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as JwtPayload;

    if (typeof decoded.adminId !== "number") {
      res.status(401).json({ message: "Invalid token." });
      return;
    }

    req.adminId = decoded.adminId;
    next();
  } catch {
    res.status(401).json({ message: "Invalid or expired token." });
  }
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many login attempts. Try again later." },
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Admin login
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const password = req.body?.password;

    if (!email || typeof password !== "string" || !password) {
      res.status(400).json({ message: "Email and password are required." });
      return;
    }

    const admin = await prisma.admin.findUnique({ where: { email } });

    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      res.status(401).json({ message: "Invalid email or password." });
      return;
    }

    const token = jwt.sign(
      { adminId: admin.id },
      JWT_SECRET!,
      { expiresIn: "8h" },
    );

    res.json({
      token,
      admin: { id: admin.id, name: admin.name, email: admin.email },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Unable to log in." });
  }
});

// Check whether the current token is valid
app.get("/api/auth/me", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.adminId! },
      select: { id: true, name: true, email: true },
    });

    if (!admin) {
      res.status(401).json({ message: "Admin account not found." });
      return;
    }

    res.json({ admin });
  } catch (error) {
    console.error("Auth check error:", error);
    res.status(500).json({ message: "Unable to verify account." });
  }
});

// Public storefront: active products only
app.get("/api/products", async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    res.json(products);
  } catch (error) {
    console.error("Products error:", error);
    res.status(500).json({ message: "Unable to load products." });
  }
});

// Admin: list all products, including hidden ones
app.get("/api/admin/products", requireAdmin, async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    });

    res.json(products);
  } catch (error) {
    console.error("Admin products error:", error);
    res.status(500).json({ message: "Unable to load products." });
  }
});

function parseImageArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  if (typeof value !== "string") {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => entry.trim())
        .filter(Boolean);
    }
  } catch {
    // Fall back to comma-delimited values.
  }

  return trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function parseProduct(body: any, uploadedFiles: Express.Multer.File[] = [], existingImages: string[] = []) {
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";
  const impression =
    typeof body?.impression === "string" ? body.impression.trim() || null : null;
  const notes =
    typeof body?.notes === "string" ? body.notes.trim() || null : null;
  const category =
    typeof body?.category === "string" ? body.category.trim() : "";
  const price = Number(body?.price);
  const stock = Number(body?.stock ?? 0);
  const sizeMl = Number(body?.sizeMl ?? 100);

  if (!name || !slug || !description || !category) {
    throw new Error("Name, slug, description, and category are required.");
  }

  if (
    !Number.isFinite(price) || price < 0 ||
    !Number.isInteger(stock) || stock < 0 ||
    !Number.isInteger(sizeMl) || sizeMl <= 0
  ) {
    throw new Error("Price, stock, or bottle size is invalid.");
  }

  const compareAtPrice =
    body.compareAtPrice === "" ||
    body.compareAtPrice === null ||
    body.compareAtPrice === undefined
      ? null
      : Number(body.compareAtPrice);

  if (
    compareAtPrice !== null &&
    (!Number.isFinite(compareAtPrice) || compareAtPrice < 0)
  ) {
    throw new Error("Previous price is invalid.");
  }

  const uploadedImageUrls = (uploadedFiles ?? []).map((file) => `/uploads/perfumes/${file.filename}`);
  const legacyImageUrls = parseImageArray(body?.existingImages ?? body?.images ?? body?.imageUrls ?? []);
  const imageList = [...new Set([
    ...existingImages,
    ...legacyImageUrls,
    ...uploadedImageUrls,
    ...(typeof body?.imageUrl === "string" && body.imageUrl.trim() ? [body.imageUrl.trim()] : []),
  ])].slice(0, 5);

  return {
    name,
    slug,
    description,
    impression,
    notes,
    category,
    price,
    compareAtPrice,
    brand: typeof body.brand === "string" && body.brand.trim()
      ? body.brand.trim()
      : "SK Perfumes",
    imageUrl: imageList[0] ?? null,
    images: JSON.stringify(imageList),
    concentration: typeof body.concentration === "string"
      ? body.concentration.trim() || null
      : null,
    stock,
    sizeMl,
    isFeatured: body.isFeatured === true || body.isFeatured === "true",
    isActive: body.isActive !== false && body.isActive !== "false",
  };
}

// Admin: create product
app.post("/api/admin/products", requireAdmin, upload.array("images", 5), async (req, res) => {
  try {
    const existingImages = parseImageArray((req.body as any)?.existingImages ?? []);
    const data = parseProduct(req.body, req.files as Express.Multer.File[] ?? [], existingImages);
    const product = await prisma.product.create({ data });
    res.status(201).json(product);
  } catch (error: any) {
    if (error?.code === "P2002") {
      res.status(409).json({ message: "That product slug already exists." });
      return;
    }
    if (error instanceof Error && error.message.includes("required") ||
        error instanceof Error && error.message.includes("invalid")) {
      res.status(400).json({ message: error.message });
      return;
    }
    console.error("Create product error:", error);
    res.status(500).json({ message: "Unable to create product." });
  }
});

// Admin: update product
app.put("/api/admin/products/:id", requireAdmin, upload.array("images", 5), async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: "Invalid product ID." });
    return;
  }

  try {
    const existingImages = parseImageArray((req.body as any)?.existingImages ?? []);
    const data = parseProduct(req.body, req.files as Express.Multer.File[] ?? [], existingImages);
    const product = await prisma.product.update({
      where: { id },
      data,
    });
    res.json(product);
  } catch (error: any) {
    if (error?.code === "P2025") {
      res.status(404).json({ message: "Product not found." });
      return;
    }
    if (error?.code === "P2002") {
      res.status(409).json({ message: "That product slug already exists." });
      return;
    }
    if (error instanceof Error &&
        (error.message.includes("required") || error.message.includes("invalid"))) {
      res.status(400).json({ message: error.message });
      return;
    }
    console.error("Update product error:", error);
    res.status(500).json({ message: "Unable to update product." });
  }
});

// Admin: delete product
app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: "Invalid product ID." });
    return;
  }

  try {
    await prisma.product.delete({ where: { id } });
    res.json({ message: "Product deleted." });
  } catch (error: any) {
    if (error?.code === "P2025") {
      res.status(404).json({ message: "Product not found." });
      return;
    }
    console.error("Delete product error:", error);
    res.status(500).json({ message: "Unable to delete product." });
  }
});


const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many order attempts. Please try again later." },
});

// Public checkout: create a cash-on-delivery order
app.post("/api/orders", orderLimiter, async (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};

    const customerName =
      typeof body.customerName === "string" ? body.customerName.trim() : "";
    const phone =
      typeof body.phone === "string" ? body.phone.trim() : "";
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const address =
      typeof body.address === "string" ? body.address.trim() : "";
    const city =
      typeof body.city === "string" ? body.city.trim() : "";
    const notes =
      typeof body.notes === "string" ? body.notes.trim() : "";

    if (
      customerName.length < 2 || customerName.length > 120 ||
      phone.length < 7 || phone.length > 30 ||
      address.length < 5 || address.length > 1000 ||
      city.length < 2 || city.length > 100 ||
      email.length > 254 ||
      (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
      notes.length > 2000
    ) {
      res.status(400).json({
        message: "Please provide valid name, phone, address, city, and optional email/notes.",
      });
      return;
    }

    if (body.paymentMethod && body.paymentMethod !== "COD") {
      res.status(400).json({
        message: "Only cash on delivery is currently available.",
      });
      return;
    }

    if (
      !Array.isArray(body.items) ||
      body.items.length < 1 ||
      body.items.length > 50
    ) {
      res.status(400).json({ message: "Your cart is empty or invalid." });
      return;
    }

    // Consolidate duplicate product IDs before checking stock.
    const quantities = new Map<number, number>();

    for (const item of body.items) {
      const productId = Number(item?.productId);
      const quantity = Number(item?.quantity);

      if (
        !Number.isSafeInteger(productId) || productId <= 0 ||
        !Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 100
      ) {
        res.status(400).json({
          message: "One or more cart items have an invalid product or quantity.",
        });
        return;
      }

      const combined = (quantities.get(productId) ?? 0) + quantity;

      if (combined > 100) {
        res.status(400).json({
          message: "The quantity for a product cannot exceed 100.",
        });
        return;
      }

      quantities.set(productId, combined);
    }

    const order = await prisma.$transaction(async (tx) => {
      const productIds = [...quantities.keys()];

      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
          isActive: true,
        },
      });

      if (products.length !== productIds.length) {
        throw new Error("CART_PRODUCT_UNAVAILABLE");
      }

      const productById = new Map(products.map((product) => [product.id, product]));

      // Calculate monetary amounts in cents to avoid floating-point totals.
      let subtotalCents = 0;

      const orderItems = productIds.map((productId) => {
        const product = productById.get(productId)!;
        const quantity = quantities.get(productId)!;
        const priceCents = Math.round(Number(product.price) * 100);

        if (!Number.isSafeInteger(priceCents) || priceCents < 0) {
          throw new Error("INVALID_PRODUCT_PRICE");
        }

        if (product.stock < quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${product.name}`);
        }

        subtotalCents += priceCents * quantity;

        return {
          productId,
          quantity,
          productName: product.name,
          productPrice: (priceCents / 100).toFixed(2),
          imageUrl: product.imageUrl,
        };
      });

      if (!Number.isSafeInteger(subtotalCents)) {
        throw new Error("ORDER_TOTAL_TOO_LARGE");
      }

      // Shipping is currently free. Change this policy here if needed.
      const shippingFeeCents = 0;
      const totalCents = subtotalCents + shippingFeeCents;

      // Atomic stock decrements prevent two concurrent orders from
      // selling the same remaining units.
      for (const item of orderItems) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            isActive: true,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (updated.count !== 1) {
          throw new Error(`INSUFFICIENT_STOCK:${item.productName}`);
        }
      }

      const orderNumber =
        `ESS-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

      return tx.order.create({
        data: {
          orderNumber,
          customerName,
          phone,
          email: email || null,
          address,
          city,
          notes: notes || null,
          subtotal: (subtotalCents / 100).toFixed(2),
          shippingFee: (shippingFeeCents / 100).toFixed(2),
          total: (totalCents / 100).toFixed(2),
          paymentMethod: "COD",
          status: "PENDING",
          items: {
            create: orderItems.map((item) => ({
              productName: item.productName,
              productPrice: item.productPrice,
              quantity: item.quantity,
              imageUrl: item.imageUrl,
            })),
          },
        },
        include: { items: true },
      });
    });

    res.status(201).json({
      message: "Order placed successfully.",
      order: {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentMethod: order.paymentMethod,
        subtotal: Number(order.subtotal),
        shippingFee: Number(order.shippingFee),
        total: Number(order.total),
        items: order.items,
        createdAt: order.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CART_PRODUCT_UNAVAILABLE") {
      res.status(400).json({
        message: "A product in your cart is no longer available. Refresh the products and try again.",
      });
      return;
    }

    if (error instanceof Error && error.message.startsWith("INSUFFICIENT_STOCK:")) {
      res.status(409).json({
        message: `${error.message.slice("INSUFFICIENT_STOCK:".length)} does not have enough stock available.`,
      });
      return;
    }

    if (error instanceof Error && error.message === "INVALID_PRODUCT_PRICE") {
      res.status(400).json({ message: "A product has an invalid price." });
      return;
    }

    if (error instanceof Error && error.message === "ORDER_TOTAL_TOO_LARGE") {
      res.status(400).json({ message: "The order total is too large." });
      return;
    }

    console.error("Create order error:", error);
    res.status(500).json({ message: "Unable to place your order. Please try again." });
  }
});


const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

// Get all orders (admin only)
app.get("/api/admin/orders", requireAdmin, async (_req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    res.json({ orders });
  } catch (error) {
    console.error("Failed to fetch orders:", error);
    res.status(500).json({ message: "Failed to load orders." });
  }
});

// Delete an order and its associated items (admin only).
app.delete("/api/admin/orders/:id", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ message: "Invalid order ID." });
    return;
  }

  try {
    await prisma.order.delete({ where: { id } });
    res.json({ message: "Order deleted." });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2025") {
      res.status(404).json({ message: "Order not found." });
      return;
    }

    console.error("Failed to delete order:", error);
    res.status(500).json({ message: "Failed to delete order." });
  }
});

// Update an order's status (admin only)
app.patch("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body as { status?: string };

    if (!Number.isInteger(id) || id < 1) {
      res.status(400).json({ message: "Invalid order ID." });
      return;
    }

    if (
      typeof status !== "string" ||
      !ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])
    ) {
      res.status(400).json({ message: "Invalid order status." });
      return;
    }

    const existingOrder = await prisma.order.findUnique({
      where: { id },
    });

    if (!existingOrder) {
      res.status(404).json({ message: "Order not found." });
      return;
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status },
    });

    res.json({ message: "Order status updated.", order });
  } catch (error) {
    console.error("Failed to update order:", error);
    res.status(500).json({ message: "Failed to update order status." });
  }
});


app.listen(PORT, () => {
  console.log(`SK Perfumes API running at http://localhost:${PORT}`);
});
