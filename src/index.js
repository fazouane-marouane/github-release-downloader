'use strict'
const path = require('path')
const {
  GitHub
} = require('./github')
const {
  DownloadsScheduler
} = require('./download')
const yargs = require('yargs')
  .usage('$0 <cmd> [args]')
  .option('token', {
    describe: 'Github\'s oauth2 token to communicate with its apis',
    required: true
  })
  .option('owner', {
    describe: 'The owner of the repository to download',
    required: true
  })
  .option('repository', {
    describe: 'The repository to download',
    required: true
  })
  .option('output', {
    alias: 'o',
    describe: 'output path where to download assets',
    default: process.cwd() 
  })
  .option('min-version', {
    alias: 'm',
    describe: 'minimum semver version to consider'
  })
  .option('parallel', {
    alias: 'p',
    describe: 'number of parallel downloads',
    default: 3
  })
  .coerce(['output'], path.resolve)
  .help()

function fatalError(error) {
  if (error.response) {
    const status = error.response.status
    const body = error.response.data
    console.error(`[FATAL] Call to github failed with status ${status}.`, body)
  } else {
    console.error('[FATAL] Error while getting releases.', error)
  }
  process.exit(1)
}

async function main(argv) {
  try {
    const api = new GitHub(argv.token)
    const dest = path.join(argv.output, argv.owner, argv.repository)
    const downloader = new DownloadsScheduler(dest, argv.parallel)
    const releases = await api.getReleases(argv.owner, argv.repository, argv.minVersion)
    for (const release of releases) {
      console.log(`releases ${release.name}\tassets count: ${release.assets.length}`)
      for (const asset of release.assets) {
        downloader.enqueue({
          filename: `${release.name}/${asset.name}`,
          url: asset.url
        })
      }
      await downloader.start()
    }
  } catch (error) {
    fatalError(error)
  }
}

main(yargs.argv)
