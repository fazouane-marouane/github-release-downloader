"use strict";
import "core-js/stable"; // included < Stage 4 proposals
import "regenerator-runtime/runtime";
import path from "path";
import { GitHub } from "./github";
import { DownloadsScheduler } from "./download";
import yargs from "yargs";

yargs
  .usage("$0 <cmd> [args]")
  .option("token", {
    describe: "Github's oauth2 token to communicate with its apis",
    required: true
  })
  .option("owner", {
    describe: "The owner of the repository to download",
    required: true
  })
  .option("repository", {
    describe: "The repository to download",
    required: true
  })
  .option("output", {
    alias: "o",
    describe: "output path where to download assets",
    default: process.cwd()
  })
  .option("min-version", {
    alias: "m",
    describe: "minimum semver version to consider",
    default: "v0.0.0-alpha"
  })
  .option("match-version", {
    alias: "mv",
    describe: "regex of versions to consider",
    default: ".*"
  })
  .option("filter-asset", {
    describe: "the assets we're interested in keeping",
    default: ".*"
  })
  .option("parallel", {
    alias: "p",
    describe: "number of parallel downloads",
    default: 3
  })
  .option("proxy", {
    describe:
      "proxy to use, if any. Will use $https_proxy or $http_proxy if no value has been passed.",
    default: false
  })
  .option("timeout", {
    alias: "t",
    describe: "timeout for download asset requests (in seconds)",
    default: 5 * 60
  })
  .option("ignore-missing-assets", {
    describe:
      "When assets are missing, continue the task without stopping the process.",
    default: true
  })
  .coerce(["output"], path.resolve)
  .coerce(["match-version", "filter-asset"], arg => {
    return new RegExp(arg);
  })
  .coerce(["proxy"], arg => {
    return arg === true
      ? process.env.https_proxy || process.env.http_proxy
      : arg;
  })
  .help();

function fatalError(error) {
  if (error.response) {
    const status = error.response.status;
    let body = error.response.data;
    if (body && body.constructor === Buffer) {
      body = body.toString("utf8");
    }
    console.error(`[FATAL] Call to github failed with status ${status}.`, body);
  } else {
    console.error("[FATAL] Error while getting releases.", error.message);
  }
  process.exit(1);
}

async function main(argv) {
  try {
    if (argv.proxy) {
      console.log("Will try using the proxy", argv.proxy);
    }
    const api = new GitHub(argv.token, argv.proxy);
    const dest = path.join(argv.output, argv.owner, argv.repository);
    const downloader = new DownloadsScheduler(
      dest,
      argv.proxy,
      argv.timeout,
      argv.parallel,
      argv.ignoreMissingAssets,

    );
    for await (const release of api.getReleases(
      argv.owner,
      argv.repository,
      argv.matchVersion,
      argv.minVersion,
      argv.filterAsset
    )) {
      console.log(
        `releases ${release.name}\tassets count: ${release.assets.length}`
      );
      for (const asset of release.assets) {
        downloader.enqueue({
          id: asset.id,
          filename: `${release.name}/${asset.name}`,
          url: asset.url
        });
      }
      await downloader.start();
    }
  } catch (error) {
    fatalError(error);
  }
}

main(yargs.argv);
