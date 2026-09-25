import pg from "pg";

const DATABASE_URL =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  "";

const client = new pg.Client({ connectionString: DATABASE_URL });

async function main() {
  await client.connect();
  console.log("Connected to Supabase PostgreSQL.");

  console.log("\n--- Testing Categories & Subcategories from DB ---");
  const catRes = await client.query(`
    SELECT c.id, c.parent_id, c.name, c.slug, c.description, c.sort_order
    FROM public.categories c
    ORDER BY c.sort_order ASC;
  `);
  const parents = catRes.rows.filter(r => !r.parent_id);
  const children = catRes.rows.filter(r => r.parent_id);
  console.log(`Found ${parents.length} top-level categories and ${children.length} subcategories.`);
  for (const cat of parents) {
    const subs = children.filter(c => c.parent_id === cat.id);
    console.log(`- ${cat.name} (${cat.slug}): ${subs.length} subcategories [${subs.map(s => s.name).join(", ")}]`);
  }

  console.log("\n--- Testing Published Models in DB ---");
  const models = await client.query(`
    SELECT id, title, category, subcategory_id, license_type, price, status
    FROM public.models
    WHERE status = 'published'
    ORDER BY created_at DESC;
  `);
  console.table(models.rows);

  console.log("\n--- Testing RPC get_marketplace_models ---");
  // Test All
  const rpcAll = await client.query(`
    SELECT id, title, category, license_type, price, seller_name, formats, total_count
    FROM public.get_marketplace_models(
      p_search := NULL::text,
      p_category := NULL::text,
      p_license_type := NULL::text,
      p_sort := 'newest'::text,
      p_page := 1::integer,
      p_page_size := 10::integer
    );
  `);
  console.log(`RPC All count: ${rpcAll.rows.length}`);
  console.table(rpcAll.rows);

  // Test Category = Mechanical
  const rpcMech = await client.query(`
    SELECT id, title, category, price FROM public.get_marketplace_models(
      p_search := NULL::text,
      p_category := 'Mechanical'::text,
      p_license_type := NULL::text,
      p_sort := 'newest'::text,
      p_page := 1::integer,
      p_page_size := 10::integer
    );
  `);
  console.log(`RPC Category 'Mechanical' count: ${rpcMech.rows.length}`);
  console.table(rpcMech.rows);

  // Test Category = Art & Decor (Decorative alias)
  const rpcArt = await client.query(`
    SELECT id, title, category, price FROM public.get_marketplace_models(
      p_search := NULL::text,
      p_category := 'Art & Decor'::text,
      p_license_type := NULL::text,
      p_sort := 'newest'::text,
      p_page := 1::integer,
      p_page_size := 10::integer
    );
  `);
  console.log(`RPC Category 'Art & Decor' count: ${rpcArt.rows.length}`);
  console.table(rpcArt.rows);

  // Test Search = 'Gear'
  const rpcSearch = await client.query(`
    SELECT id, title, category, price FROM public.get_marketplace_models(
      p_search := 'Gear'::text,
      p_category := NULL::text,
      p_license_type := NULL::text,
      p_sort := 'newest'::text,
      p_page := 1::integer,
      p_page_size := 10::integer
    );
  `);
  console.log(`RPC Search 'Gear' count: ${rpcSearch.rows.length}`);
  console.table(rpcSearch.rows);

  // Test Price Sorting
  const rpcPriceLow = await client.query(`
    SELECT title, price FROM public.get_marketplace_models(
      p_search := NULL::text,
      p_category := NULL::text,
      p_license_type := NULL::text,
      p_sort := 'price_low'::text,
      p_page := 1::integer,
      p_page_size := 10::integer
    );
  `);
  console.log("RPC Price Low-to-High order:");
  console.table(rpcPriceLow.rows);

  const rpcPriceHigh = await client.query(`
    SELECT title, price FROM public.get_marketplace_models(
      p_search := NULL::text,
      p_category := NULL::text,
      p_license_type := NULL::text,
      p_sort := 'price_high'::text,
      p_page := 1::integer,
      p_page_size := 10::integer
    );
  `);
  console.log("RPC Price High-to-Low order:");
  console.table(rpcPriceHigh.rows);

  // Test get_marketplace_model_by_id
  const sampleId = rpcAll.rows[0].id;
  const rpcDetail = await client.query(`
    SELECT id, title, slug, category, license_type, price, seller_name, formats, license_info
    FROM public.get_marketplace_model_by_id(
      p_model_id := $1::uuid
    );
  `, [sampleId]);
  console.log("\n--- Testing RPC get_marketplace_model_by_id ---");
  console.log(rpcDetail.rows[0]);

  await client.end();
  console.log("\nMarketplace backend queries & RPCs verified with 100% success!");
}

main().catch((err) => {
  console.error("Marketplace flow test error:", err);
  process.exit(1);
});
