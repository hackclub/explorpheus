import "dotenv/config";
import data from "./data.json" with { type: "json" };
import { handleTeamJoinThing } from "../src/undocumented.js";
import { WebClient } from "@slack/web-api";
import { AirtableFetch } from "../src/airtableFetch.js";
const env = process.env;
const client = new WebClient(process.env.SLACK_XOXB);
const airtable = new AirtableFetch({
  apiKey: env.AIRTABLE_KEY,
  baseID: env.BASE_ID,
  tableName: "explorpheus",
});

(async () => {
  for (const item of data) {
    console.log(`Trying for ${item.Email}`);
    await handleTeamJoinThing(
      client,
      airtable,
      process.env,
      [],
      item["Slack ID"],
    );
    console.log(`It worked for ${item.Email}`);
    await new Promise((r) => setTimeout(r, 500));
  }
})();
