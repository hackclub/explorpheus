import "dotenv/config";
import Keyv from "keyv";
import KeyvPostgres from "@keyv/postgres";

// Connect to PostgreSQL (use your actual DB credentials)
const keyv = new Keyv(new KeyvPostgres(process.env.PG_CONNECTION_STRING));

// Optional: handle connection errors
keyv.on("error", (err) => console.error("Keyv connection error:", err));

// Set a key
await keyv.set("foo", "bar");

// Get a key
const value = await keyv.get("foo");
console.log(value); // 'bar'

// Delete a key
// await keyv.delete('foo');
