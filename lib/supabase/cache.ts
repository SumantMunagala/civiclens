import { createClient } from "./server";

export async function getCached(cacheKey: string, maxAgeMinutes: number) {
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("api_cache")
    .select("*")
    .eq("cache_key", cacheKey)
    .single();

  if (error || !data) return null;

  const fetchedAt = new Date(data.fetched_at);
  const ageMinutes = (Date.now() - fetchedAt.getTime()) / 60000;

  if (ageMinutes >= maxAgeMinutes) return null;

  return data.cache_data;
}

export async function setCache(cacheKey: string, cacheData: any) {
  const supabase = createClient();
  
  // Upsert: delete old cache and insert new one
  await supabase
    .from("api_cache")
    .delete()
    .eq("cache_key", cacheKey);

  await supabase
    .from("api_cache")
    .insert({
      cache_key: cacheKey,
      cache_data: cacheData,
      fetched_at: new Date().toISOString(),
    });
}
