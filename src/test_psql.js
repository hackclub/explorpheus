import "dotenv/config";
import { Pool } from "pg";
const client = new Pool({
  connectionString: process.env.PG_CONNECTION_STRING_SOM,
});
console.log("meow");
console.log(
  client.query(
    `SELECT * FROM "payouts"
WHERE "user_id" IN ('2');`,
    (_e, d) => console.log(_e ? _e : d.rows),
  ),
);
client.end();
