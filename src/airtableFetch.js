// @see stolen from https://github.com/hackclub/arrpheus/blob/main/src/airtableFetch.ts
export class AirtableFetch {
  // same api as Airtable-Plus but uses raw fetch() with no retry logic
  // urlBase = 'https://middleman.hackclub.com/airtable/v0/'
  urlBase = "https://api.airtable.com/v0/";
  constructor({ apiKey, baseID, tableName }) {
    this.apiKey = apiKey;
    this.baseID = baseID;
    this.tableName = tableName;
    this.url = this.urlBase + baseID + "/" + tableName;
  }

  async read(args, userAgent = "Explorpheus/1.0.0") {
    let paramsObj = {};
    if (args && args.filterByFormula) {
      //console.log(`encoding formula: ${args.filterByFormula}`)
      const newFormula = args.filterByFormula
        .replaceAll(",", "%2C")
        .replaceAll("=", "%3D")
        .replaceAll("{", "%7B")
        .replaceAll("}", "%7D")
        .replaceAll("+", "%2B")
        .replaceAll("/", "%2F")
        .replaceAll(" ", "+"); // ' and , aren't encoded and <space>->+ for some reason
      //console.log(`encoded formula: ${newFormula}`)
      paramsObj["filterByFormula"] = newFormula;
    }
    if (args && args.maxRecords) {
      paramsObj["maxRecords"] = args.maxRecords;
    }
    if (args && args.view) {
      paramsObj["view"] = args.view;
    }

    let params = "";
    for (const key in paramsObj) {
      params += `${key}=${paramsObj[key]}&`;
    }

    if (args && args.sortString) {
      params += args.sortString;
    }

    console.log("Fetching from Airtable:");
    console.log(this.url + "?" + params);
    const res = await fetch(this.url + "?" + params, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "User-Agent": userAgent,
      },
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Failed to fetch from Airtable: ${res.status} ${res.statusText} ${body}`,
      );
    }
    const json = await res.json();
    console.log("Response JSON:");
    console.log(json);
    return json.records;
  }

  async update(recordId, fields, userAgent = "Explorpheus/1.0.0") {
    const res = await fetch(this.url + "/" + recordId, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": userAgent,
      },
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Failed to update Airtable record: ${res.status} ${res.statusText} ${body}`,
      );
    }
    try {
      const json = await res.json();
      return json;
    } catch (e) {
      console.log(e);
      return { error: e, ok: false };
    }
  }

  async updateBulk(records, userAgent = "Explorpheus/1.0.0") {
    const res = await fetch(this.url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": userAgent,
      },
      body: JSON.stringify({ records }),
    });
    try {
      const json = await res.json();
      return json;
    } catch (e) {
      console.log(e);
      return { error: e, ok: false };
    }
  }
  async createBulk(
    records,
    userAgent = "Explorpheus/1.0.0",
    baseID = this.baseID,
    tableName = this.tableName,
  ) {
    let url = this.urlBase + baseID + "/" + tableName;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": userAgent,
      },
      body: JSON.stringify({ records }),
    });
    try {
      const json = await res.json();
      return json;
    } catch (e) {
      console.log(e);
      return { error: e, ok: false };
    }
  }
}
