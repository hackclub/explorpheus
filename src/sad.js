import "dotenv/config";
import { AirtableFetch } from "./airtableFetch.js";
import { handleMCGInvite, handleTeamJoinThing } from "./undocumented.js";
import { z } from "zod";

const App = await import("@slack/bolt");

let env0 = z
  .object({
    SLACK_XOXB: z.string(),
    SLACK_XOXC: z.string(),
    SLACK_XOXD: z.string(),
    AIRTABLE_KEY: z.string(),
    BASE_ID: z.string(),
    API_KEY: z.string(),
    APP_TOKEN: z.string().optional(),
    SLACK_SIGNING_SECRET: z.string(),
    LOOPS_ID: z.string(),
    LOOPS_API_KEY: z.string(),
    JR_BASE_ID: z.string(),
    SLACK_XOXP: z.string(),
    UPTIME_URL_THING: z.string(),
    DOMAIN_OF_HOST: z.string(),
    GARDENS_URL: z.string().optional(),
  })
  .safeParse(process.env);
if (env0.error) {
  throw env0.error;
}
const env = env0.data;
let last_5_users = [];
const receiver = new App.default.ExpressReceiver({
  signingSecret: env.SLACK_SIGNING_SECRET,
  endpoints: "/slack/events", // This is the default endpoint for Slack events
});
const aclient = new App.default.App({
  token: env.SLACK_XOXB,
  receiver,
});
const client = aclient.client;
const airtable = new AirtableFetch({
  apiKey: env.AIRTABLE_KEY,
  baseID: env.BASE_ID,
  tableName: "explorpheus",
});
const try_again = [
  {
    user: "U09214DE4M7",
  },
  {
    user: "U091NHLA9D0",
  },
  {
    user: "U091P2BNSCU",
  },
  {
    user: "U091P2RAGF6",
  },
  {
    user: "U09216A4DNV",
  },
  {
    user: "U092162UK4Z",
  },
  {
    user: "U091FKML76F",
  },
  {
    user: "U091LS9503F",
  },
  {
    user: "U091LSEJ3TP",
  },
  {
    user: "U091NJWMJLA",
  },
  {
    user: "U091NKH293L",
  },
  {
    user: "U091FL36C5R",
  },
  {
    user: "U091NKJPKEE",
  },
  {
    user: "U09217XAWC9",
  },
  {
    user: "U091FQE9QR4",
  },
  {
    user: "U091P48PH28",
  },
  {
    user: "U09218H3SEM",
  },
  {
    user: "U091LUE39U5",
  },
  {
    user: "U0921A8HQ1X",
  },
  {
    user: "U091M07RMHB",
  },
  {
    user: "U091NN8EM50",
  },
  {
    user: "U092B7G1QQG",
  },
  {
    user: "U0921A7MQD7",
  },
  {
    user: "U092B83CCMN",
  },
  {
    user: "U091FPLSRHR",
  },
  {
    user: "U091P75SXEY",
  },
  {
    user: "U091NNWRRC2",
  },
  {
    user: "U091FT5F38W",
  },
  {
    user: "U091P58V1RA",
  },
  {
    user: "U091FTHPEKG",
  },
  {
    user: "U091M0PPT61",
  },
  {
    user: "U091FQE57V1",
  },
  {
    user: "U091P7NDFC4",
  },
  {
    user: "U091FTLS8GN",
  },
  {
    user: "U091M19PNSZ",
  },
  {
    user: "U0917EVP5L7",
  },
  {
    user: "U0917FK2V6K",
  },
  {
    user: "U0917FRG355",
  },
  {
    user: "U091FRFD5D1",
  },
  {
    user: "U091P9AELCC",
  },
  {
    user: "U0917GB56AK",
  },
  {
    user: "U0917FNGBP1",
  },
  {
    user: "U091FS4CQ03",
  },
  {
    user: "U0917GP3X1V",
  },
  {
    user: "U091FUC6JTG",
  },
  {
    user: "U091NQZADPU",
  },
  {
    user: "U091M03N1HT",
  },
  {
    user: "U091FT2G5L3",
  },
  {
    user: "U091PAE5HD2",
  },
  {
    user: "U0921DY255F",
  },
  {
    user: "U091NS1CZK4",
  },
  {
    user: "U091G0T87V4",
  },
  {
    user: "U091PAM7N8L",
  },
  {
    user: "U091NT7NJ4S",
  },
  {
    user: "U091FTY1YQ3",
  },
  {
    user: "U091M2VPL3F",
  },
  {
    user: "U091P9C581J",
  },
];

for (const item of try_again) {
  try {
    const user = item.user;
    console.log(`Trying to promote user ${user}`);
    const result = await handleTeamJoinThing(
      client,
      airtable,
      env,
      last_5_users,
      user,
    );
    if (result) {
      console.log(`Successfully promoted user ${user}`);
    } else {
      console.log(`Failed to promote user ${user}`);
    }
  } catch (error) {
    console.error(`Error promoting user ${item.user}:`, error);
  }
  await new Promise((r) => setTimeout(r, 1000)); // wait 1 second between each request
}
