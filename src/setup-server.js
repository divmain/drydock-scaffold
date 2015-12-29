import zlib from "zlib";

import Hapi from "hapi";
import request from "request";
import Promise from "bluebird";

import text from "./text";
import { printRow } from "./util";

const requestP = Promise.promisify(request);
const gunzip = Promise.promisify(zlib.gunzip, { context: zlib });


let lastTransaction = 0;

function decompress (body, headers) {
  const encoding = headers["content-encoding"];
  return encoding && encoding.indexOf("gzip") === -1 ?
    Promise.resolve(body) :
    Promise.resolve()
      .then(() => gunzip(body))
      .catch(() => body);
}

export default function setupServer ({ ip, port }, onRequest, onResponse, onError) {
  const server = new Hapi.Server(ip, port, {
    cors: true
  });

  server.route({
    method: "*",
    path: "/{path*}",
    handler: function (req, reply) {
      const transactionNo = lastTransaction++;
      const { method, headers, payload, url: {
        protocol,
        hostname,
        pathname,
        href
      } } = req;

      onRequest({ method, protocol, hostname, pathname, href, headers, payload, transactionNo });

      requestP({
        url: href,
        method,
        headers,
        body: payload,
        encoding: null
      })
        .then(({ statusCode, body, headers: responseHeaders }) => {
          let r = reply(body)
            .code(statusCode);
          Object.keys(responseHeaders).forEach(header => {
            r = r.header(header, responseHeaders[header]);
          });

          return decompress(body, responseHeaders).then(decompressedBody => {
            return onResponse({
              statusCode,
              method,
              href,
              transactionNo,
              body: decompressedBody,
              headers: responseHeaders
            });
          });
        })
        .catch(err => {
          onError(transactionNo);
          printRow(transactionNo, text("ERROR").cyan(), err.stack);
          reply("").code(500);
          return;
        });
    }
  });

  return [
    Promise.promisify(server.start.bind(server)),
    Promise.promisify(server.stop.bind(server))
  ];
}
