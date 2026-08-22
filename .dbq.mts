import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
const q = process.argv[2];
if (q === "snapshot") {
  const posts = await sql`select count(*)::int as n from posts`;
  const people = await sql`select count(*)::int as n from post_people`;
  const lock = await sql`select to_regclass('image_generation_lock') as t`;
  const col = await sql`select column_name from information_schema.columns where table_name='posts' and column_name='runpod_job_id'`;
  console.log(`posts=${posts[0].n} people=${people[0].n} lock_table=${lock[0].t ?? "gone"} runpod_job_id_col=${col.length ? "present" : "MISSING"}`);
  const recent = await sql`select id, status, network, created_at from posts order by created_at desc limit 5`;
  for (const r of recent) console.log(`  ${r.id}  ${String(r.status).padEnd(9)} ${r.network}  ${new Date(r.created_at).toISOString()}`);
} else if (q === "post") {
  const id = process.argv[3];
  const [p] = await sql`select id, status, network, runpod_job_id, avatar_url, post_image_url, image_attempts, error from posts where id = ${id}`;
  console.log(p ? JSON.stringify(p, null, 2) : "NOT FOUND");
  const people = await sql`select id, role, avatar_url from post_people where post_id = ${id} order by position`;
  for (const r of people) console.log(`  ${r.id.padEnd(14)} ${r.role.padEnd(9)} ${r.avatar_url ? "has-url" : "NULL"}`);
} else if (q === "delete") {
  const id = process.argv[3];
  await sql`delete from posts where id = ${id}`;
  console.log(`deleted ${id} (post_people cascades)`);
}
