import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import "./admin.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

function resolveImageUrl(image: string) {
  if (/^(https?:|blob:|data:)/i.test(image)) return image;
  return image.startsWith("/") ? `${API}${image}` : image;
}

type Product = {
  id: number;
  name: string;
  slug: string;
  brand: string;
  description: string;
  impression: string | null;
  notes: string | null;
  price: string | number;
  compareAtPrice: string | number | null;
  imageUrl: string | null;
  images?: string[] | string | null;
  category: string;
  concentration: string | null;
  sizeMl: number;
  stock: number;
  isFeatured: boolean;
  isActive: boolean;
};

type OrderItem = {
  id: number;
  productName: string;
  productPrice: string | number;
  quantity: number;
  imageUrl: string | null;
};

type Order = {
  id: number;
  orderNumber: string;
  customerName: string;
  phone: string;
  email: string | null;
  address: string;
  city: string;
  notes: string | null;
  subtotal: string | number;
  shippingFee: string | number;
  total: string | number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  items: OrderItem[];
};

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"];

type ProductForm = {
  name: string;
  slug: string;
  brand: string;
  description: string;
  impression: string;
  notes: string;
  price: string;
  compareAtPrice: string;
  imageUrl: string;
  category: string;
  concentration: string;
  sizeMl: string;
  stock: string;
  isFeatured: boolean;
  isActive: boolean;
};

const emptyForm: ProductForm = {
  name: "",
  slug: "",
  brand: "SK Perfumes",
  description: "",
  impression: "",
  notes: "",
  price: "",
  compareAtPrice: "",
  imageUrl: "",
  category: "Men",
  concentration: "Eau de Parfum",
  sizeMl: "100",
  stock: "0",
  isFeatured: false,
  isActive: true,
};

function slugify(value: string) {
  return value.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function Admin() {
  const [token, setToken] = useState(() => localStorage.getItem("essence_admin_token") || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<"products" | "orders">("products");
  const [orderSearch, setOrderSearch] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [adminName, setAdminName] = useState("Administrator");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);

  async function request(path: string, options: RequestInit = {}) {
    const isFormData = options.body instanceof FormData;

    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        ...(!isFormData ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401 && token) {
      logout();
      throw new Error("Your session expired. Please sign in again.");
    }

    if (!response.ok) {
      throw new Error(data.message || "Something went wrong.");
    }

    return data;
  }

  function logout() {
    localStorage.removeItem("essence_admin_token");
    setToken("");
    setProducts([]);
    setOrders([]);
    setPassword("");
  }

  async function loadProducts() {
    const data = await request("/api/admin/products");
    setProducts(data);
  }

  async function loadOrders() {
    const data = await request("/api/admin/orders");
    setOrders(Array.isArray(data.orders) ? data.orders : []);
  }

  async function updateOrderStatus(order: Order, status: string) {
    setError("");
    setMessage("");
    try {
      await request(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await loadOrders();
      setMessage(`Order ${order.orderNumber} updated to ${status.toLowerCase()}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update order status.");
    }
  }

  async function deleteOrder(order: Order) {
    const confirmed = window.confirm(
      `Delete order ${order.orderNumber} permanently? This action cannot be undone.`,
    );
    if (!confirmed) return;

    setError("");
    setMessage("");
    try {
      await request(`/api/admin/orders/${order.id}`, { method: "DELETE" });
      setOrders((current) => current.filter((item) => item.id !== order.id));
      if (expandedOrderId === order.id) setExpandedOrderId(null);
      setMessage(`Order ${order.orderNumber} deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete order.");
    }
  }

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    async function initialize() {
      try {
        const data = await request("/api/auth/me");
        if (cancelled) return;
        setAdminName(data.admin.name);
        await loadProducts();
        await loadOrders();
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load dashboard.");
      }
    }

    void initialize();
    return () => { cancelled = true; };
    // Re-run when the login token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.message || "Login failed.");

      localStorage.setItem("essence_admin_token", data.token);
      setAdminName(data.admin.name);
      setToken(data.token);
      setPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to log in.");
    } finally {
      setBusy(false);
    }
  }

  function parseProductImages(value: Product["images"]): string[] {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
    }

    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim());
        }
      } catch {
        // Ignore invalid JSON and fall back to single string.
      }

      return value.trim() ? [value.trim()] : [];
    }

    return [];
  }

  function handleImageFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, 5);
    setImageFiles(files);
    event.target.value = "";
  }

  function startNewProduct() {
    setEditingId(null);
    setForm(emptyForm);
    setImageFiles([]);
    setExistingImages([]);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function startEdit(product: Product) {
    const productImages = parseProductImages(product.images ?? product.imageUrl ?? null);
    setEditingId(product.id);
    setForm({
      name: product.name,
      slug: product.slug,
      brand: product.brand || "SK Perfumes",
      description: product.description,
      impression: product.impression || "",
      notes: product.notes || "",
      price: String(product.price),
      compareAtPrice: product.compareAtPrice == null ? "" : String(product.compareAtPrice),
      imageUrl: productImages[0] || product.imageUrl || "",
      category: product.category,
      concentration: product.concentration || "",
      sizeMl: String(product.sizeMl),
      stock: String(product.stock),
      isFeatured: product.isFeatured,
      isActive: product.isActive,
    });
    setImageFiles([]);
    setExistingImages(productImages);
    setShowForm(true);
    setError("");
    setMessage("");
  }

  function updateField<K extends keyof ProductForm>(key: K, value: ProductForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveProduct(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    const payload = new FormData();
    payload.set("name", form.name.trim());
    payload.set("slug", (form.slug.trim() || slugify(form.name)).trim());
    payload.set("brand", form.brand.trim() || "SK Perfumes");
    payload.set("description", form.description.trim());
    payload.set("impression", form.impression.trim());
    payload.set("notes", form.notes.trim());
    payload.set("price", String(Number(form.price)));
    payload.set("compareAtPrice", form.compareAtPrice ? String(Number(form.compareAtPrice)) : "");
    payload.set("category", form.category);
    payload.set("concentration", form.concentration.trim());
    payload.set("sizeMl", String(Number(form.sizeMl)));
    payload.set("stock", String(Number(form.stock)));
    payload.set("isFeatured", String(form.isFeatured));
    payload.set("isActive", String(form.isActive));

    if (imageFiles.length > 0) {
      imageFiles.slice(0, 5).forEach((file) => payload.append("images", file));
    }

    if (existingImages.length > 0) {
      payload.set("existingImages", JSON.stringify(existingImages.slice(0, 5)));
    }

    try {
      await request(
        editingId === null ? "/api/admin/products" : `/api/admin/products/${editingId}`,
        {
          method: editingId === null ? "POST" : "PUT",
          body: payload,
        },
      );
      await loadProducts();
      setShowForm(false);
      setImageFiles([]);
      setExistingImages([]);
      setMessage(editingId === null ? "Perfume added successfully." : "Product updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save product.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteProduct(product: Product) {
    if (!window.confirm(`Delete "${product.name}" permanently?`)) return;

    setError("");
    setMessage("");

    try {
      await request(`/api/admin/products/${product.id}`, { method: "DELETE" });
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setMessage("Product deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete product.");
    }
  }

  const previewImages = useMemo(() => {
    const blobImages = imageFiles.map((file) => URL.createObjectURL(file));
    return [...existingImages.map(resolveImageUrl), ...blobImages];
  }, [existingImages, imageFiles]);

  useEffect(() => {
    return () => {
      previewImages.forEach((image) => {
        if (image.startsWith("blob:")) URL.revokeObjectURL(image);
      });
    };
  }, [previewImages]);

  const filteredProducts = products.filter((product) =>
    `${product.name} ${product.brand} ${product.category}`
      .toLowerCase().includes(search.toLowerCase()),
  );

  const filteredOrders = orders.filter((order) =>
    `${order.orderNumber} ${order.customerName} ${order.phone} ${order.email || ""} ${order.status}`
      .toLowerCase().includes(orderSearch.toLowerCase()),
  );

  const formatMoney = (value: string | number) => Number(value).toLocaleString("en-PK", {
    maximumFractionDigits: 2,
  });

  const formatDate = (value: string) => new Date(value).toLocaleString();

  if (!token) {
    return (
      <main className="admin-login-page">
        <form className="admin-login-card" onSubmit={handleLogin}>
          <div className="admin-brand-mark">E</div>
          <p className="admin-eyebrow">SK PERFUMES</p>
          <h1>Welcome back</h1>
          <p className="admin-muted">Sign in to manage your perfume store.</p>

          {error && <div className="admin-alert error">{error}</div>}

          <label>
            Email address
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@yourstore.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />
          </label>

          <button className="admin-primary-button full-width" disabled={busy}>
            {busy ? "Signing in…" : "Sign in to dashboard"}
          </button>
          <a className="admin-back-link" href="/">← Back to storefront</a>
        </form>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-sidebar-brand" href="/admin">
          <span className="admin-brand-mark small">E</span>
          <span>SK PERFUMES<small>ADMIN STUDIO</small></span>
        </a>

        <p className="admin-nav-label">WORKSPACE</p>
        <button className={`admin-nav-link ${activeTab === "products" ? "active" : ""}`} style={{ width: "100%", border: 0, textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => { setActiveTab("products"); setError(""); setMessage(""); }}>▦ &nbsp; Products</button>
        <button className={`admin-nav-link ${activeTab === "orders" ? "active" : ""}`} style={{ width: "100%", border: 0, textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => { setActiveTab("orders"); setError(""); setMessage(""); void loadOrders().catch((err) => setError(err instanceof Error ? err.message : "Could not load orders.")); }}>▤ &nbsp; Orders <span style={{ marginLeft: "auto" }}>{orders.length || ""}</span></button>
        <a className="admin-nav-link" href="/">↗ &nbsp; View storefront</a>

        <div className="admin-sidebar-bottom">
          <div className="admin-avatar">{adminName.slice(0, 1).toUpperCase()}</div>
          <div className="admin-user-details">
            <strong>{adminName}</strong>
            <small>Store administrator</small>
          </div>
          <button className="admin-logout" onClick={logout} title="Sign out">↪</button>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <span>Store management <span className="admin-slash">/</span> {activeTab === "products" ? "Products" : "Orders"}</span>
          <span className="admin-status"><i /> Admin access</span>
        </header>

        <div className="admin-content">
          {activeTab === "products" ? <>
          <div className="admin-page-heading">
            <div>
              <p className="admin-eyebrow">YOUR COLLECTION</p>
              <h1>Products</h1>
              <p className="admin-muted">Manage your fragrances, prices, imagery and inventory.</p>
            </div>
            <button className="admin-primary-button" onClick={startNewProduct}>＋ Add perfume</button>
          </div>

          {error && <div className="admin-alert error">{error}</div>}
          {message && <div className="admin-alert success">{message}</div>}

          <div className="admin-stats">
            <div className="admin-stat-card">
              <span>Total products</span>
              <strong>{products.length}</strong>
              <small>In your catalogue</small>
            </div>
            <div className="admin-stat-card">
              <span>Published</span>
              <strong>{products.filter((item) => item.isActive).length}</strong>
              <small>Visible in storefront</small>
            </div>
            <div className="admin-stat-card">
              <span>Low stock</span>
              <strong>{products.filter((item) => item.stock > 0 && item.stock <= 5).length}</strong>
              <small>Five or fewer units</small>
            </div>
            <div className="admin-stat-card">
              <span>Out of stock</span>
              <strong>{products.filter((item) => item.stock === 0).length}</strong>
              <small>Needs replenishment</small>
            </div>
          </div>

          <section className="admin-products-panel">
            <div className="admin-products-toolbar">
              <div>
                <h2>All perfumes</h2>
                <p>{filteredProducts.length} products found</p>
              </div>
              <input
                className="admin-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search perfumes…"
                aria-label="Search products"
              />
            </div>

            {filteredProducts.length === 0 ? (
              <div className="admin-empty">
                <div className="admin-empty-icon">◇</div>
                <h3>{search ? "No matching perfumes" : "Your collection starts here"}</h3>
                <p>{search ? "Try a different search." : "Add your first perfume to begin building your catalogue."}</p>
                {!search && <button className="admin-primary-button" onClick={startNewProduct}>＋ Add your first perfume</button>}
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>PRODUCT</th>
                      <th>CATEGORY</th>
                      <th>PRICE</th>
                      <th>STOCK</th>
                      <th>STATUS</th>
                      <th>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <div className="admin-product-cell">
                            {product.imageUrl
                              ? <img src={resolveImageUrl(parseProductImages(product.images ?? product.imageUrl)[0] || product.imageUrl)} alt="" />
                              : <div className="admin-product-placeholder">E</div>}
                            <div>
                              <strong>{product.name}</strong>
                              <small>{product.sizeMl} ml · {product.brand}</small>
                            </div>
                          </div>
                        </td>
                        <td>{product.category}</td>
                        <td>
                          <strong>Rs. {Number(product.price).toLocaleString()}</strong>
                          {product.compareAtPrice != null && (
                            <small className="admin-old-price">Rs. {Number(product.compareAtPrice).toLocaleString()}</small>
                          )}
                        </td>
                        <td>
                          <span className={product.stock <= 5 ? "admin-stock low" : "admin-stock"}>
                            {product.stock} units
                          </span>
                        </td>
                        <td><span className={`admin-pill ${product.isActive ? "published" : "hidden"}`}>{product.isActive ? "Published" : "Hidden"}</span></td>
                        <td>
                          <div className="admin-row-actions">
                            <button onClick={() => startEdit(product)}>Edit</button>
                            <button className="danger" onClick={() => void deleteProduct(product)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <p className="admin-footer-note">SK PERFUMES · PRODUCT MANAGEMENT</p>
          </> : <>
            <div className="admin-page-heading">
              <div>
                <p className="admin-eyebrow">CUSTOMER CHECKOUTS</p>
                <h1>Orders</h1>
                <p className="admin-muted">Review customer details, track cash-on-delivery orders, and update fulfillment status.</p>
              </div>
              <button className="admin-primary-button" onClick={() => { setError(""); setMessage(""); void loadOrders().catch((err) => setError(err instanceof Error ? err.message : "Could not refresh orders.")); }}>↻ Refresh orders</button>
            </div>

            {error && <div className="admin-alert error">{error}</div>}
            {message && <div className="admin-alert success">{message}</div>}

            <div className="admin-stats">
              <div className="admin-stat-card"><span>Total orders</span><strong>{orders.length}</strong><small>All customer checkouts</small></div>
              <div className="admin-stat-card"><span>Pending</span><strong>{orders.filter((order) => order.status === "PENDING").length}</strong><small>Awaiting confirmation</small></div>
              <div className="admin-stat-card"><span>In progress</span><strong>{orders.filter((order) => ["CONFIRMED", "PROCESSING", "SHIPPED"].includes(order.status)).length}</strong><small>Being fulfilled</small></div>
              <div className="admin-stat-card"><span>Delivered</span><strong>{orders.filter((order) => order.status === "DELIVERED").length}</strong><small>Successfully completed</small></div>
            </div>

            <section className="admin-products-panel">
              <div className="admin-products-toolbar">
                <div><h2>All orders</h2><p>{filteredOrders.length} orders found</p></div>
                <input className="admin-search" value={orderSearch} onChange={(event) => setOrderSearch(event.target.value)} placeholder="Search order, customer, phone…" aria-label="Search orders" />
              </div>
              {filteredOrders.length === 0 ? (
                <div className="admin-empty"><div className="admin-empty-icon">◇</div><h3>{orderSearch ? "No matching orders" : "No orders yet"}</h3><p>{orderSearch ? "Try a different order number, name, or phone." : "Customer checkouts will appear here when an order is placed."}</p></div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>ORDER</th><th>CUSTOMER</th><th>DATE</th><th>TOTAL</th><th>PAYMENT</th><th>STATUS</th><th>ACTIONS</th></tr></thead>
                    <tbody>{filteredOrders.map((order) => <>
                      <tr key={order.id}>
                        <td><strong>{order.orderNumber}</strong><small>{order.items.reduce((sum, item) => sum + item.quantity, 0)} item(s)</small></td>
                        <td><strong>{order.customerName}</strong><small>{order.phone}</small></td>
                        <td>{formatDate(order.createdAt)}</td>
                        <td><strong>Rs. {formatMoney(order.total)}</strong></td>
                        <td>{order.paymentMethod === "COD" ? "Cash on delivery" : order.paymentMethod}</td>
                        <td><select aria-label={`Status for ${order.orderNumber}`} value={order.status} onChange={(event) => void updateOrderStatus(order, event.target.value)} style={{ maxWidth: 150, padding: "8px", borderRadius: 8, border: "1px solid #ddd", background: "white" }}>{ORDER_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></td>
                        <td><div className="admin-row-actions"><button onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}>{expandedOrderId === order.id ? "Hide" : "View"}</button><button className="danger" onClick={() => void deleteOrder(order)}>Delete</button></div></td>
                      </tr>
                      {expandedOrderId === order.id && <tr key={`${order.id}-details`}><td colSpan={7}>
                        <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20, background: "#faf8f5", borderRadius: 10 }}>
                          <div><strong>Delivery details</strong><p style={{ margin: "8px 0 4px" }}>{order.customerName}</p><p style={{ margin: "4px 0" }}>{order.address}, {order.city}</p><p style={{ margin: "4px 0" }}>{order.phone}</p><p style={{ margin: "4px 0" }}>{order.email || "No email provided"}</p>{order.notes && <p style={{ margin: "8px 0 0" }}><strong>Notes:</strong> {order.notes}</p>}</div>
                          <div><strong>Items ordered</strong>{order.items.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid #e8e3dc" }}><span>{item.productName} × {item.quantity}</span><strong>Rs. {formatMoney(Number(item.productPrice) * item.quantity)}</strong></div>)}<div style={{ paddingTop: 10 }}><p style={{ margin: "4px 0" }}>Subtotal: Rs. {formatMoney(order.subtotal)}</p><p style={{ margin: "4px 0" }}>Shipping: Rs. {formatMoney(order.shippingFee)}</p><strong>Total: Rs. {formatMoney(order.total)}</strong></div></div>
                        </div>
                      </td></tr>}
                    </>)}</tbody>
                  </table>
                </div>
              )}
            </section>
            <p className="admin-footer-note">SK PERFUMES · ORDER MANAGEMENT</p>
          </>}
        </div>
      </section>

      {showForm && (
        <div className="admin-modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowForm(false);
        }}>
          <section className="admin-product-modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title">
            <div className="admin-modal-header">
              <div>
                <p className="admin-eyebrow">{editingId === null ? "EXPAND YOUR COLLECTION" : "PRODUCT DETAILS"}</p>
                <h2 id="product-form-title">{editingId === null ? "Add a perfume" : "Edit perfume"}</h2>
              </div>
              <button className="admin-close-button" onClick={() => setShowForm(false)} aria-label="Close">×</button>
            </div>

            <form onSubmit={saveProduct}>
              <div className="admin-form-grid">
                <label className="span-two">
                  Perfume name *
                  <input required value={form.name} onChange={(event) => {
                    const name = event.target.value;
                    setForm((current) => ({
                      ...current,
                      name,
                      slug: editingId === null ? slugify(name) : current.slug,
                    }));
                  }} />
                </label>
                <label>
                  Price (Rs.) *
                  <input required type="number" min="0" step="0.01" value={form.price} onChange={(event) => updateField("price", event.target.value)} />
                </label>
                <label>
                  Previous price (Rs.)
                  <input type="number" min="0" step="0.01" value={form.compareAtPrice} onChange={(event) => updateField("compareAtPrice", event.target.value)} />
                </label>
                <label>
                  Category *
                  <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
                    <option>Men</option>
                    <option>Women</option>
                    <option>Unisex</option>
                    <option>Luxury</option>
                    <option>Gift Sets</option>
                  </select>
                </label>
                <label>
                  Concentration
                  <select value={form.concentration} onChange={(event) => updateField("concentration", event.target.value)}>
                    <option>Eau de Parfum</option>
                    <option>Eau de Toilette</option>
                    <option>Parfum</option>
                    <option>Eau de Cologne</option>
                    <option>Perfume Oil</option>
                  </select>
                </label>
                <label>
                  Bottle size (ml) *
                  <input required type="number" min="1" step="1" value={form.sizeMl} onChange={(event) => updateField("sizeMl", event.target.value)} />
                </label>
                <label>
                  Stock quantity *
                  <input required type="number" min="0" step="1" value={form.stock} onChange={(event) => updateField("stock", event.target.value)} />
                </label>
                <label className="span-two">
                  Perfume images (up to 5)
                  <input type="file" accept="image/*" multiple onChange={handleImageFilesChange} />
                  <small>Upload up to five product images. The first image becomes the storefront cover.</small>
                </label>
                {previewImages.length > 0 && (
                  <div className="admin-image-preview span-two">
                    {previewImages.slice(0, 5).map((image, index) => (
                      <div key={`${image}-${index}`} className="admin-product-preview-item">
                        <img src={image} alt={`Product preview ${index + 1}`} onError={(event) => { event.currentTarget.style.display = "none"; }} />
                      </div>
                    ))}
                    <span>{previewImages.length} image(s)</span>
                  </div>
                )}
                <label className="span-two">
                  Description *
                  <textarea required rows={4} value={form.description} onChange={(event) => updateField("description", event.target.value)} />
                </label>
                <label className="span-two">
                  Impression
                  <textarea rows={3} value={form.impression} onChange={(event) => updateField("impression", event.target.value)} placeholder="Describe the character and feeling of this fragrance." />
                </label>
                <label className="span-two">
                  Fragrance notes
                  <textarea rows={3} value={form.notes} onChange={(event) => updateField("notes", event.target.value)} placeholder="List the key scent notes, such as citrus, rose, or sandalwood." />
                </label>
                <label className="span-two">
                  URL slug *
                  <input required value={form.slug} onChange={(event) => updateField("slug", event.target.value)} />
                  <small>Used in product links; must be unique.</small>
                </label>
                <label className="admin-check">
                  <input type="checkbox" checked={form.isFeatured} onChange={(event) => updateField("isFeatured", event.target.checked)} />
                  Feature this perfume
                </label>
                <label className="admin-check">
                  <input type="checkbox" checked={form.isActive} onChange={(event) => updateField("isActive", event.target.checked)} />
                  Publish in storefront
                </label>
              </div>

              <div className="admin-modal-actions">
                <button type="button" className="admin-secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="admin-primary-button" disabled={busy}>{busy ? "Saving…" : editingId === null ? "Add perfume" : "Save changes"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
