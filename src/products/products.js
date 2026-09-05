import { supabase } from "../supabase.js";

export async function getActiveProducts(env) {
  return supabase(
    env,
    "products?is_active=eq.true&order=id.asc"
  );
}

export async function getProduct(env, productId) {
  const products = await supabase(
    env,
    `products?id=eq.${productId}&limit=1`
  );

  return products[0] || null;
}
