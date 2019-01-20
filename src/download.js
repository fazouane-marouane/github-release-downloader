"use strict";
import axios from "axios";
import fs from "fs";
import path from "path";
import { promisify } from "util";
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const existsAsync = promisify(fs.exists);

async function ensureDirectoryExistence(filePath) {
  const dirnames = [path.dirname(filePath)];
  let backTracking = false;
  while (dirnames.length > 0) {
    const dirname = dirnames.pop();
    if (backTracking) {
      await mkdirAsync(dirname);
    } else if (await existsAsync(dirname)) {
      backTracking = true;
    } else {
      dirnames.push(dirname, path.dirname(dirname));
    }
  }
}

export class DownloadsScheduler {
  constructor(dest, proxy, parallelism = 1) {
    this.instance = axios.create({
      timeout: 5 * 60 * 1000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5) \
        AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36"
      },
      ...(proxy ? { proxy } : null)
    });
    this.dest = dest;
    this.parallelism = parallelism;
    this.queue = [];
  }

  enqueue(entry) {
    this.queue.push(entry);
  }

  async handleDownload(entry) {
    const { filename, url } = entry;
    const fullfilename = path.join(this.dest, filename);
    const idFilename = fullfilename + ".id";
    if ((await existsAsync(fullfilename)) && (await existsAsync(idFilename))) {
      const oldId = (await readFileAsync(idFilename)).toString();
      if (oldId === entry.id) {
        console.log(`file ${filename} is already up-to-date.`);
        return;
      }
    }
    console.log("fetching", filename);
    const response = await this.instance.get(url, {
      responseType: "arraybuffer"
    });
    await ensureDirectoryExistence(fullfilename);
    console.log("writing", filename);
    await writeFileAsync(fullfilename, response.data, "binary");
    await writeFileAsync(idFilename, entry.id);
  }

  async enqueueDownloadTask(initialEntry) {
    await this.handleDownload(initialEntry);
    while (this.queue.length > 0) {
      const entry = this.queue.shift();
      await this.handleDownload(entry);
    }
  }

  async start() {
    const pendingTasks = this.queue
      .splice(0, this.parallelism)
      .map(entry => this.enqueueDownloadTask(entry));
    await Promise.all(pendingTasks);
  }
}
