import "dotenv/config"
import { Pool } from "pg";
const client = new Pool({
    connectionString: process.env.PG_CONNECTION_STRING_SOM,
    });
    console.log('meow')
    console.log(client.query("SELECT id from users WHERE slack_id = 'U07L45W79E1';", (_e, d)=> console.log(d.rows)))
    client.end()