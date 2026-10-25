
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  Heart,
  Camera,
  Menu,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";

type Category = "For Him" | "For Her" | "Unisex";

type Perfume = {
  id: number | string;
  name: string;
  brand: string;
  category: Category;
  price: number;
  description: string;
  notes: string;
  image: string;
  tag?: string;
};

type CartItem = {
  product: Perfume;
  quantity: number;
};


const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const formatPrice = (price: number) =>
  `Rs. ${price.toLocaleString("en-PK")}`;

const readSavedCart = (): CartItem[] => {
  try {
    const saved = localStorage.getItem("essence-cart");
    if (!saved) return [];
    const parsed = JSON.parse(saved) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function App() {
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Perfume | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [notice, setNotice] = useState("");
  const [favorites, setFavorites] = useState<(number | string)[]>([]);
  const [perfumes, setPerfumes] = useState<Perfume[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        setProductsLoading(true);
        setProductsError("");

        const response = await fetch(`${API_URL}/api/products`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Could not load fragrances.");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error("The products API returned an unexpected response.");
        }

        const mappedProducts: Perfume[] = data.map((product) => ({
          id: product.id,
          name: product.name,
          brand: product.brand || "",
          category: (product.category === "Men"
            ? "For Him"
            : product.category === "Women"
              ? "For Her"
              : ["For Him", "For Her", "Unisex"].includes(product.category)
                ? product.category
                : "Unisex") as Category,
          price: Number(product.price),
          description: product.description || "",
          notes: product.concentration || "",
          image: product.imageUrl || "",
          tag: product.isFeatured ? "FEATURED" : undefined,
        }));

        setPerfumes(mappedProducts);
        setCart(
          readSavedCart().flatMap((item) => {
            const product = mappedProducts.find(
              (candidate) => String(candidate.id) === String(item.product.id),
            );
            return product ? [{ ...item, product }] : [];
          }),
        );
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;

        setProductsError(
          error instanceof Error
            ? error.message
            : "Something went wrong loading fragrances.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setProductsLoading(false);
        }
      }
    }

    loadProducts();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (productsLoading || productsError) return;
    localStorage.setItem("essence-cart", JSON.stringify(cart));
  }, [cart, productsError, productsLoading]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2400);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const visiblePerfumes = useMemo(() => {
    const term = search.trim().toLowerCase();

    return perfumes.filter((perfume) => {
      const matchesCategory =
        category === "All" || perfume.category === category;

      const matchesSearch =
        !term ||
        `${perfume.name} ${perfume.brand} ${perfume.category} ${perfume.notes}`
          .toLowerCase()
          .includes(term);

      return matchesCategory && matchesSearch;
    });
  }, [category, perfumes, search]);

  const categoryCollections = useMemo(
    () =>
      (["For Him", "For Her", "Unisex"] as Category[])
        .map((name) => ({
          name,
          products: perfumes.filter((perfume) => perfume.category === name),
        }))
        .filter((collection) => collection.products.length > 0),
    [perfumes],
  );

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cart.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );

  const addToCart = (product: Perfume) => {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);

      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      return [...current, { product, quantity: 1 }];
    });

    setNotice(`${product.name} added to your bag`);
  };

  const changeQuantity = (productId: number | string, change: number) => {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + change }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const toggleFavorite = (productId: number | string) => {
    setFavorites((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  };

  const scrollToCollection = () => {
    document.getElementById("collection")?.scrollIntoView({
      behavior: "smooth",
    });
    setMobileMenuOpen(false);
  };

  return (
    <main className="min-h-screen bg-[#f8f6f1] text-[#26231f]">
      {/* Announcement */}
      <div className="bg-[#25231f] px-4 py-2.5 text-center text-[10px] tracking-[0.2em] text-[#e7d5ad] sm:text-xs">
        A LITTLE LUXURY, DELIVERED TO YOUR DOOR
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-black/10 bg-[#f8f6f1]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-10">
          <button
            className="flex items-center gap-2 lg:hidden"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <a href="#home" className="text-center leading-none">
            <span className="block text-xl font-light tracking-[0.28em] sm:text-2xl">
              SK PERFUMES
            </span>
            <span className="mt-1 block text-[8px] tracking-[0.35em] text-[#92764b] sm:text-[9px]">
              FRAGRANCE HOUSE
            </span>
          </a>

          <nav className="hidden items-center gap-8 text-[10px] tracking-[0.16em] lg:flex">
            <a href="#home" className="transition hover:text-[#a18450]">
              HOME
            </a>
            <a href="#collection" className="transition hover:text-[#a18450]">
              COLLECTION
            </a>
            <a href="#categories" className="transition hover:text-[#a18450]">
              SHOP BY TYPE
            </a>
            <a href="#story" className="transition hover:text-[#a18450]">
              OUR STORY
            </a>
          </nav>

          <div className="flex items-center gap-3 sm:gap-5">
            <button
              onClick={() => setSearchOpen((open) => !open)}
              className="transition hover:text-[#a18450]"
              aria-label="Toggle search"
            >
              {searchOpen ? <X size={20} /> : <Search size={20} />}
            </button>

            <button
              onClick={() => setCartOpen(true)}
              className="relative transition hover:text-[#a18450]"
              aria-label={`Shopping bag, ${cartCount} items`}
            >
              <ShoppingBag size={21} />
              {cartCount > 0 && (
                <span className="absolute -right-2 -top-2 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#b69a68] px-1 text-[9px] text-white">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="border-t border-black/10 px-5 py-4">
            <div className="mx-auto flex max-w-3xl items-center gap-3 border-b border-[#b9aa91] pb-2">
              <Search size={18} className="text-[#92764b]" />
              <input
                autoFocus
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  document.getElementById("collection")?.scrollIntoView({
                    behavior: "smooth",
                  });
                }}
                placeholder="Search fragrances, notes, or collections..."
                className="w-full bg-transparent py-2 text-sm outline-none placeholder:text-[#999187]"
              />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear search">
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        {mobileMenuOpen && (
          <nav className="flex flex-col border-t border-black/10 bg-[#f8f6f1] px-6 py-4 text-xs tracking-[0.18em] lg:hidden">
            <a href="#home" onClick={() => setMobileMenuOpen(false)} className="py-3">
              HOME
            </a>
            <a href="#collection" onClick={() => setMobileMenuOpen(false)} className="py-3">
              COLLECTION
            </a>
            <a href="#categories" onClick={() => setMobileMenuOpen(false)} className="py-3">
              SHOP BY TYPE
            </a>
            <a href="#story" onClick={() => setMobileMenuOpen(false)} className="py-3">
              OUR STORY
            </a>
          </nav>
        )}
      </header>

      {/* Hero */}
      <section
        id="home"
        className="relative flex min-h-[570px] items-center overflow-hidden bg-[#25231f] sm:min-h-[650px]"
      >
        {perfumes[0]?.image && (
          <img
            src={perfumes[0].image}
            alt={perfumes[0].name}
            className="absolute inset-0 h-full w-full object-cover object-center opacity-45"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-[#171612]/95 via-[#171612]/70 to-[#171612]/10" />

        <div className="relative z-10 mx-auto w-full max-w-7xl px-6 py-20 lg:px-10">
          <div className="max-w-2xl">
            <div className="mb-6 flex items-center gap-3 text-[10px] tracking-[0.28em] text-[#ddc79d] sm:text-xs">
              <span className="h-px w-10 bg-[#c2a36b]" />
              DISCOVER YOUR SIGNATURE
            </div>
            <h1 className="text-5xl font-light leading-[1.08] tracking-tight text-[#fffdf7] sm:text-6xl md:text-7xl lg:text-8xl">
              Scent is
              <br />
              <span className="font-serif italic text-[#d9c29a]">
                your story.
              </span>
            </h1>
            <p className="mt-6 max-w-md text-sm leading-7 text-white/75 sm:text-base">
              Discover thoughtfully selected fragrances that capture a mood,
              create a memory, and make every moment yours.
            </p>
            <button
              onClick={scrollToCollection}
              className="mt-9 inline-flex items-center gap-4 bg-[#d7c29b] px-7 py-4 text-[10px] tracking-[0.2em] text-[#28241d] transition hover:bg-white"
            >
              EXPLORE THE COLLECTION <ArrowRight size={16} />
            </button>
          </div>
        </div>

        <div className="absolute bottom-8 right-6 hidden items-center gap-3 text-[9px] tracking-[0.2em] text-white/65 sm:flex lg:right-10">
          <span>CRAFTED FOR EVERY CHAPTER</span>
          <ArrowDown size={14} />
        </div>
      </section>

      {/* Benefits */}
      <section className="border-b border-black/10 bg-[#eeebe3]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-black/10 px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:px-10">
          <div className="flex items-center justify-center gap-3 py-6">
            <Sparkles size={18} className="text-[#9b7b48]" />
            <div>
              <p className="text-[10px] tracking-[0.15em]">CURATED FRAGRANCES</p>
              <p className="mt-1 text-xs text-[#81796e]">Find your signature scent</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 py-6">
            <ShoppingBag size={18} className="text-[#9b7b48]" />
            <div>
              <p className="text-[10px] tracking-[0.15em]">THOUGHTFUL PACKAGING</p>
              <p className="mt-1 text-xs text-[#81796e]">Every detail matters</p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-3 py-6">
            <Check size={18} className="text-[#9b7b48]" />
            <div>
              <p className="text-[10px] tracking-[0.15em]">PERSONAL SERVICE</p>
              <p className="mt-1 text-xs text-[#81796e]">Here to help you choose</p>
            </div>
          </div>
        </div>
      </section>

      {/* Collection */}
      <section id="collection" className="mx-auto max-w-7xl px-5 py-20 sm:py-24 lg:px-10">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="mb-3 text-[10px] tracking-[0.25em] text-[#9b7b48]">
              THE FRAGRANCE EDIT
            </p>
            <h2 className="text-4xl font-light tracking-tight sm:text-5xl">
              Find your <span className="font-serif italic">essence.</span>
            </h2>
            <p className="mt-4 max-w-lg text-sm leading-6 text-[#777066]">
              Explore distinctive scents selected to complement every mood,
              moment, and personality.
            </p>
          </div>
          <p className="text-xs tracking-wider text-[#81796e]">
            {visiblePerfumes.length} FRAGRANCES
          </p>
        </div>

        <div className="mt-9 flex flex-wrap gap-2">
              {["All", "For Her", "For Him", "Unisex"].map((item) => (
            <button
              key={item}
              onClick={() => setCategory(item)}
              className={`border px-5 py-2.5 text-[10px] tracking-[0.12em] transition ${
                category === item
                  ? "border-[#28251f] bg-[#28251f] text-white"
                  : "border-black/15 bg-transparent hover:border-[#9b7b48]"
              }`}
            >
              {item.toUpperCase()}
            </button>
          ))}
          {search && (
            <button
              onClick={() => setSearch("")}
              className="flex items-center gap-2 px-3 text-xs text-[#8c7146]"
            >
              Clear search <X size={13} />
            </button>
          )}
        </div>

        {productsLoading ? (
          <div className="py-20 text-center text-sm text-[#81796e]">
            Loading fragrances...
          </div>
        ) : productsError ? (
          <div className="py-20 text-center">
            <p className="text-sm text-red-700">{productsError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-5 border border-[#28251f] px-5 py-3 text-xs tracking-widest"
            >
              TRY AGAIN
            </button>
          </div>
        ) : visiblePerfumes.length === 0 ? (
          <div className="py-20 text-center">
            <Search size={30} className="mx-auto text-[#b69a68]" />
            <h3 className="mt-4 text-xl">No fragrances found</h3>
            <p className="mt-2 text-sm text-[#777066]">
              Try a different search or select another category.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setCategory("All");
              }}
              className="mt-5 border border-[#28251f] px-5 py-3 text-xs tracking-widest"
            >
              RESET FILTERS
            </button>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {visiblePerfumes.map((perfume) => (
              <article key={perfume.id} className="group">
                <div className="relative overflow-hidden bg-[#ebe6dc]">
                  <button
                    onClick={() => setSelectedProduct(perfume)}
                    className="block w-full text-left"
                    aria-label={`View ${perfume.name} details`}
                  >
                    {perfume.image ? (
                      <img
                        src={perfume.image}
                        alt={perfume.name}
                        loading="lazy"
                        className="aspect-[4/5] w-full object-cover transition duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="aspect-[4/5] w-full" />
                    )}
                  </button>

                  {perfume.tag && (
                    <span className="absolute left-3 top-3 bg-[#f8f6f1] px-3 py-2 text-[8px] tracking-[0.14em]">
                      {perfume.tag}
                    </span>
                  )}

                  <button
                    onClick={() => toggleFavorite(perfume.id)}
                    className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#f8f6f1]/90 transition hover:bg-white"
                    aria-label={
                      favorites.includes(perfume.id)
                        ? "Remove from wishlist"
                        : "Add to wishlist"
                    }
                  >
                    <Heart
                      size={16}
                      className={
                        favorites.includes(perfume.id)
                          ? "fill-[#9e554e] text-[#9e554e]"
                          : "text-[#39352f]"
                      }
                    />
                  </button>

                  <button
                    onClick={() => addToCart(perfume)}
                    className="absolute bottom-0 left-0 right-0 flex translate-y-full items-center justify-center gap-2 bg-[#28251f] py-4 text-[10px] tracking-[0.18em] text-white transition-transform duration-300 group-hover:translate-y-0 focus:translate-y-0"
                  >
                    <Plus size={14} /> QUICK ADD
                  </button>
                </div>

                <button
                  onClick={() => setSelectedProduct(perfume)}
                  className="mt-5 block text-left"
                >
                  {perfume.brand && (
                    <p className="text-[9px] tracking-[0.2em] text-[#9b7b48]">
                      {perfume.brand}
                    </p>
                  )}
                  <h3 className="mt-2 text-lg font-light">{perfume.name}</h3>
                </button>
                {perfume.notes && (
                  <p className="mt-1 text-xs text-[#81796e]">{perfume.notes}</p>
                )}
                <p className="mt-3 text-sm">{formatPrice(perfume.price)}</p>
                <button
                  onClick={() => addToCart(perfume)}
                  className="mt-3 w-full border border-black/15 py-3 text-[10px] tracking-[0.15em] transition hover:border-[#28251f] hover:bg-[#28251f] hover:text-white sm:hidden"
                >
                  ADD TO BAG
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Categories */}
      <section id="categories" className="bg-[#eae5da] px-5 py-20 sm:py-24 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 text-center">
            <p className="mb-3 text-[10px] tracking-[0.25em] text-[#9b7b48]">
              MADE FOR YOUR MOMENTS
            </p>
            <h2 className="text-4xl font-light sm:text-5xl">
              Shop by <span className="font-serif italic">feeling.</span>
            </h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {categoryCollections.map(({ name, products }) => (
              <button
                key={name}
                onClick={() => {
                  setCategory(name);
                  scrollToCollection();
                }}
                className="group relative min-h-[370px] overflow-hidden text-left sm:min-h-[440px]"
              >
                {products[0].image && (
                  <img
                    src={products[0].image}
                    alt={products[0].name}
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-black/5" />
                <div className="absolute bottom-0 left-0 right-0 p-7 text-white sm:p-9">
                  <p className="text-[9px] tracking-[0.2em] text-[#e5d0a7]">
                    EXPLORE THE COLLECTION
                  </p>
                  <h3 className="mt-3 text-3xl font-light">{name}</h3>
                  <p className="mt-2 text-xs text-white/75">
                    {products.length} {products.length === 1 ? "fragrance" : "fragrances"}
                  </p>
                  <span className="mt-6 inline-flex items-center gap-3 text-[10px] tracking-[0.18em]">
                    SHOP NOW <ArrowRight size={15} />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Brand story */}
      <section id="story" className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:py-24 md:grid-cols-2 lg:gap-20 lg:px-10">
        <div className="relative">
          {perfumes[0]?.image && (
            <img
              src={perfumes[0].image}
              alt={perfumes[0].name}
              loading="lazy"
              className="aspect-[5/4] w-full object-cover"
            />
          )}
          <div className="absolute -bottom-5 -right-3 hidden border border-[#c0a675] bg-[#f8f6f1] px-6 py-5 sm:block">
            <p className="font-serif text-2xl italic">Wear a memory.</p>
            <p className="mt-1 text-[9px] tracking-[0.18em] text-[#81796e]">
              THE SK PERFUMES PHILOSOPHY
            </p>
          </div>
        </div>

        <div className="md:py-8">
          <p className="mb-4 text-[10px] tracking-[0.25em] text-[#9b7b48]">
            A NOTE ABOUT US
          </p>
          <h2 className="text-4xl font-light leading-tight sm:text-5xl">
            More than a scent.
            <br />
            <span className="font-serif italic">A feeling that stays.</span>
          </h2>
          <p className="mt-6 text-sm leading-7 text-[#777066]">
            We believe fragrance is personal. It can take you back to a
            treasured memory, change the mood of a moment, or become part of
            the way the world remembers you.
          </p>
          <p className="mt-4 text-sm leading-7 text-[#777066]">
            SK Perfumes brings together distinctive fragrance experiences for
            people who appreciate character, craftsmanship, and the beauty
            of the details.
          </p>
          <button
            onClick={scrollToCollection}
            className="mt-8 inline-flex items-center gap-3 border-b border-[#9b7b48] pb-2 text-[10px] tracking-[0.18em] transition hover:text-[#9b7b48]"
          >
            DISCOVER OUR FRAGRANCES <ArrowRight size={15} />
          </button>
        </div>
      </section>

      {/* Closing banner */}
      <section className="bg-[#28251f] px-5 py-16 text-center text-[#f8f6f1] sm:py-20">
        <Sparkles size={22} className="mx-auto text-[#c9ad79]" />
        <p className="mt-5 text-[10px] tracking-[0.25em] text-[#d3bb8f]">
          YOUR NEXT SIGNATURE AWAITS
        </p>
        <h2 className="mt-4 text-3xl font-light sm:text-5xl">
          Find the fragrance that feels like you.
        </h2>
        <button
          onClick={scrollToCollection}
          className="mt-8 inline-flex items-center gap-3 bg-[#d7c29b] px-7 py-4 text-[10px] tracking-[0.2em] text-[#28241d] transition hover:bg-white"
        >
          SHOP THE COLLECTION <ArrowRight size={16} />
        </button>
      </section>

      {/* Footer */}
      <footer className="bg-[#f8f6f1] px-5 pb-8 pt-12 lg:px-10">
        <div className="mx-auto grid max-w-7xl gap-10 border-b border-black/10 pb-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <a href="#home" className="inline-block">
              <span className="block text-2xl font-light tracking-[0.25em]">
                SK PERFUMES
              </span>
              <span className="mt-1 block text-[8px] tracking-[0.35em] text-[#92764b]">
                FRAGRANCE HOUSE
              </span>
            </a>
            <p className="mt-5 max-w-xs text-xs leading-6 text-[#81796e]">
              Fragrances for every mood, every memory, and every version of you.
            </p>
          </div>

          <div>
            <h3 className="text-[10px] tracking-[0.2em]">EXPLORE</h3>
            <div className="mt-5 flex flex-col gap-3 text-xs text-[#81796e]">
              <a href="#collection" className="hover:text-[#9b7b48]">All fragrances</a>
              <a href="#categories" className="hover:text-[#9b7b48]">Shop by type</a>
              <a href="#story" className="hover:text-[#9b7b48]">Our story</a>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] tracking-[0.2em]">CUSTOMER CARE</h3>
            <div className="mt-5 flex flex-col gap-3 text-xs text-[#81796e]">
              <span>Shipping information</span>
              <span>Returns and exchanges</span>
              <span>Frequently asked questions</span>
              <span>Contact us</span>
            </div>
          </div>

          <div>
            <h3 className="text-[10px] tracking-[0.2em]">STAY CONNECTED</h3>
            <p className="mt-5 text-xs leading-6 text-[#81796e]">
              Follow along for fragrance inspiration and new arrivals.
            </p>
            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-xs transition hover:text-[#9b7b48]"
            >
              <Camera size={17} /> Instagram
            </a>
          </div>
        </div>

        <div className="mx-auto flex max-w-7xl flex-col gap-3 pt-6 text-[10px] text-[#928a7e] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} SK Perfumes.</p>
          <p>Made with care for fragrance lovers.</p>
        </div>
      </footer>

      {/* Toast notification */}
      {notice && (
        <div className="fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 bg-[#28251f] px-5 py-4 text-xs text-white shadow-xl">
          <Check size={17} className="text-[#d7c29b]" />
          {notice}
        </div>
      )}

      {/* Product details modal */}
      {selectedProduct && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProduct(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedProduct.name} details`}
            className="relative grid max-h-[90vh] w-full max-w-3xl overflow-y-auto bg-[#f8f6f1] sm:grid-cols-2"
          >
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center bg-[#f8f6f1]"
              aria-label="Close product details"
            >
              <X size={19} />
            </button>
            {selectedProduct.image && (
              <img
                src={selectedProduct.image}
                alt={selectedProduct.name}
                className="h-64 w-full object-cover sm:h-full sm:min-h-[430px]"
              />
            )}
            <div className="flex flex-col justify-center p-6 sm:p-9">
              {selectedProduct.brand && (
                <p className="text-[9px] tracking-[0.2em] text-[#9b7b48]">
                  {selectedProduct.brand}
                </p>
              )}
              <h2 className="mt-3 text-3xl font-light">{selectedProduct.name}</h2>
              <p className="mt-4 text-lg">{formatPrice(selectedProduct.price)}</p>
              {selectedProduct.description && (
                <p className="mt-5 text-sm leading-7 text-[#777066]">
                  {selectedProduct.description}
                </p>
              )}
              <div className="border-y border-black/10 py-4">
                <p className="text-[9px] tracking-[0.18em] text-[#9b7b48]">
                  FRAGRANCE NOTES
                </p>
                {selectedProduct.notes && (
                  <p className="mt-2 text-sm">{selectedProduct.notes}</p>
                )}
                <p className="mt-3 text-xs text-[#81796e]">
                  Collection: {selectedProduct.category}
                </p>
              </div>
              <button
                onClick={() => {
                  addToCart(selectedProduct);
                  setSelectedProduct(null);
                  setCartOpen(true);
                }}
                className="mt-6 flex items-center justify-center gap-3 bg-[#28251f] px-5 py-4 text-[10px] tracking-[0.17em] text-white transition hover:bg-[#9b7b48]"
              >
                <ShoppingBag size={16} /> ADD TO BAG — {formatPrice(selectedProduct.price)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shopping cart drawer */}
      {cartOpen && (
        <div
          className="fixed inset-0 z-[60] bg-black/50"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCartOpen(false);
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label="Shopping bag"
            className="absolute bottom-0 right-0 top-0 flex w-full max-w-md flex-col bg-[#f8f6f1] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-black/10 px-6 py-5">
              <div>
                <h2 className="text-xl font-light">Your shopping bag</h2>
                <p className="mt-1 text-[10px] tracking-wider text-[#81796e]">
                  {cartCount} {cartCount === 1 ? "ITEM" : "ITEMS"}
                </p>
              </div>
              <button onClick={() => setCartOpen(false)} aria-label="Close cart">
                <X size={22} />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
                <ShoppingBag size={34} className="text-[#b69a68]" />
                <h3 className="mt-5 text-xl font-light">Your bag is waiting.</h3>
                <p className="mt-2 text-sm text-[#81796e]">
                  Discover a fragrance that feels uniquely yours.
                </p>
                <button
                  onClick={() => {
                    setCartOpen(false);
                    scrollToCollection();
                  }}
                  className="mt-6 bg-[#28251f] px-6 py-4 text-[10px] tracking-[0.17em] text-white"
                >
                  EXPLORE FRAGRANCES
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-6">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex gap-4 border-b border-black/10 py-5"
                    >
                      {item.product.image && (
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="h-28 w-24 object-cover"
                        />
                      )}
                      <div className="flex flex-1 flex-col">
                        {item.product.brand && (
                          <p className="text-[9px] tracking-[0.15em] text-[#9b7b48]">
                            {item.product.brand}
                          </p>
                        )}
                        <h3 className="mt-1 text-base">{item.product.name}</h3>
                        <p className="mt-2 text-sm">
                          {formatPrice(item.product.price)}
                        </p>
                        <div className="mt-auto flex items-center gap-4 pt-3">
                          <div className="flex items-center border border-black/15">
                            <button
                              onClick={() => changeQuantity(item.product.id, -1)}
                              className="p-2"
                              aria-label={`Decrease ${item.product.name} quantity`}
                            >
                              <Minus size={13} />
                            </button>
                            <span className="min-w-7 text-center text-xs">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => changeQuantity(item.product.id, 1)}
                              className="p-2"
                              aria-label={`Increase ${item.product.name} quantity`}
                            >
                              <Plus size={13} />
                            </button>
                          </div>
                          <button
                            onClick={() =>
                              setCart((current) =>
                                current.filter(
                                  (cartItem) =>
                                    cartItem.product.id !== item.product.id,
                                ),
                              )
                            }
                            className="text-[10px] text-[#81796e] underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-black/10 px-6 py-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Subtotal</span>
                    <span className="text-lg">{formatPrice(subtotal)}</span>
                  </div>
                  <button
                    onClick={() => setCartOpen(false)}
                    className="mt-5 w-full py-3 text-[10px] tracking-[0.15em] text-[#81796e]"
                  >
                    CONTINUE SHOPPING
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
