// a
const THE_CHANNEL_LIST = "C08MYN7HVN2,C08N1NWKEF4,C016DEDUL87,C75M7C0SY"; // #journey,#journey-feed,#cdn,#welcome
const liveQueue = [];

app.post("/new_user", (req, res) => {
  // 1. validate auth
  if (req.headers.authorization !== `Bearer ${env.API_KEY}`) {
    return res.status(403).send("Forbidden");
  }
  if (!req.body?.email) {
    return res.status(400).send("No email or body found");
  }
  // 2. add to queue
  liveQueue.push({
    email: req.body.email,
  });
  // 3. respond with OK
  res.send("OK");
});

function NoDiff(obj1, obj2) {
  if (typeof obj1.email !== "string" || typeof obj2.email !== "string") {
    return true; // dont care atp
  }
  if (typeof obj1.status !== "string" || typeof obj2.status !== "string") {
    return true;
  }
  if (obj1.email !== obj2.email) return false;
  if (obj1.status !== obj2.status) return false;
  return true;
}
async function syncToAirtable() {
  const currentRecords = await airtable.read().then((d) => d);
  const mashed = [];
  const mashed2 = [];
  for (const item of liveQueue) {
    const foundItem = currentRecords.find((r) => r.fields.email === item.email);
    if (foundItem && NoDiff(item, foundItem.fields)) {
      // already exists and isnt changed, skip
      continue;
    }
    if (foundItem) {
      console.log("foundItem", foundItem, item);
      // const formulatedObject=
      mashed2.push({
        id: foundItem.id,
        fields: {
          email: item.email,
          status: item.status,
          failed_attempts: item.failed_attempts || 0,
        },
      });
    } else {
      mashed.push({
        fields: {
          email: item.email,
          status: item.status || "Pending",
          identifier: item.identifier || crypto.randomUUID(),
        },
      });
    }
  }
  // update records mass
  if (mashed.length > 0) {
    airtable.createBulk(mashed).then(console.log).catch(console.error);
  }
  if (mashed2.length > 0) {
    airtable.updateBulk(mashed2).catch(console.error).then(console.log);
  }
}
async function doTheQueueLoop() {
  if (liveQueue.length > 0) {
    await doTheQueue();
    await new Promise((r) => setTimeout(r, 500));
    await syncToAirtable();
  }
  await new Promise((r) => setTimeout(r, 1000 * 60)); // wait 1 minutes
  doTheQueueLoop();
}
async function doTheQueue() {
  if (liveQueue.length === 0) return;
  let modifying = [];
  for (const item of liveQueue) {
    if (item.status == "Invitation Sent") continue;
    inviteGuestToSlackToriel({
      email: item.email,
      channels: THE_CHANNEL_LIST,
      env,
    })
      .then(async (_d) => {
        console.log(_d, "A OK");
        item.status = "Invitation Sent";
        modifying.push(item);
        // lets rotate to sending them with how to blah blah
        // get user by email
        const user = await client.users.lookupByEmail({ email: item.email });
        console.log(user);
        await client.chat.postMessage({
          channel: user.user.id,
          text: FAT_MESSAGE,
        });
      })
      .catch((err) => {
        console.error(err, "NOOOO");
        item.status = "Failed, pending retry";
        if (typeof item.failed_attempts !== "number") item.failed_attempts = 0;
        item.failed_attempts += 1;
        modifying.push(item);
      });
  }
}
