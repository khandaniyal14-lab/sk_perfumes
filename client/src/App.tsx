import Storefront from "./Storefront";
import Admin from "./admin";

export default function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  if (path === "/admin") {
    return <Admin />;
  }

  return <Storefront />;
}