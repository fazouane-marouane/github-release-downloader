'use strict'
const https = require('https')
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const {
  URL
} = require('url');
const {
  promisify
} = require('bluebird')
const readFileAsync = promisify(fs.readFile)
const writeFileAsync = promisify(fs.writeFile)
const mkdirAsync = promisify(fs.mkdir)
const existsAsync = promisify(function exists2(path, exists2callback) {
  fs.exists(path, function callbackWrapper(exists) {
    exists2callback(null, exists)
  })
})

async function ensureDirectoryExistence(filePath) {
  const dirnames = [path.dirname(filePath)]
  let backTracking = false
  while (dirnames.length > 0) {
    const dirname = dirnames.pop()
    if (backTracking) {
      await mkdirAsync(dirname)
    } else if (await existsAsync(dirname)) {
      backTracking = true
    } else {
      dirnames.push(dirname, path.dirname(dirname))
    }
  }
}

function getHeaderWithoutDownloading(url, headers) {
  return new Promise((resolve, reject) => {
    const urlObject = new URL(url)
    const req = https.request({
      method: 'GET',
      protocol: urlObject.protocol,
      hostname: urlObject.hostname,
      path: urlObject.pathname + urlObject.search,
      headers: headers
    }, (res) => {
      const {
        statusCode
      } = res

      if (statusCode !== 200) {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        })
        res.on('end', () => {
          const error = new Error(`Request Failed. Status Code: ${statusCode}\n${rawData}`)
          return reject(error)
        })
      } else {
        resolve(res.headers)
      }
    }).on('error', (e) => {
      reject(e)
    })
    req.end()
  })
}

module.exports.DownloadsScheduler = class DownloadsScheduler {
  constructor(dest, parallelism = 1) {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5) \
        AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
    }
    this.instance = axios.create({
      headers: headers
    })
    this.dest = dest
    this.parallelism = parallelism
    this.queue = []
    this.getEtag = (url) => getHeaderWithoutDownloading(url, headers)
  }

  enqueue(entry) {
    this.queue.push(entry)
  }

  async handleDownload(entry) {
    const {
      filename,
      url
    } = entry
    const fullfilename = path.join(this.dest, filename)
    const etagFilename = fullfilename + '.etag'
    if (await existsAsync(fullfilename) && await existsAsync(etagFilename)) {
      const oldEtag = (await readFileAsync(etagFilename)).toString()
      const headers = await this.getEtag(url)
      const newEtag = headers.etag
      if (oldEtag === newEtag) {
        console.log(`file ${filename} is already up-to-date.`)
        return
      }
    }
    console.log('fetching', filename)
    const response = await this.instance.get(url, {
      responseType: 'arraybuffer'
    })
    await ensureDirectoryExistence(fullfilename)
    console.log('writing', filename)
    const etag = response.headers.etag
    await writeFileAsync(fullfilename, response.data, "binary")
    await writeFileAsync(etagFilename, etag)
  }

  async enqueueDownloadTask(initial) {
    await this.handleDownload(initial)
    while (this.queue.length > 0) {
      const entry = this.queue.shift()
      await this.handleDownload(entry)
    }
  }

  async start() {
    const pendingTasks = this.queue.splice(0, this.parallelism)
      .map(entry => this.enqueueDownloadTask(entry))
    await Promise.all(pendingTasks)
  }
}
