import fs from "fs";
import url from "url";


export default function (filepath) {
  const harRaw = fs.readFileSync(filepath);
  const har = JSON.parse(harRaw);

  return har.log.entries.map(entry => {
    const entryUrl = url.parse(entry.request.url);

    return {
      method: entry.request.method,
      hostname: entryUrl.hostname,
      pathname: entryUrl.pathname,
      href: entryUrl.href,
      statusCode: entry.response.status,
      responseBody: entry.response.content.text,
      responseHeaders: entry.response.headers.reduce((obj, header) => {
        obj[header.name] = header.value;
        return obj;
      }, {}),
      hadError: false
    };
  });
}
