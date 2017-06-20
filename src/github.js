'use strict'
const axios = require('axios')
const semver = require('semver')

const getReleasesQuery = `
query($cursor: String, $owner: String!, $repository: String!) {
  repository(owner: $owner, name: $repository) {
    releases(first: 100, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
      nodes {
        tag {
          name
        }
        releaseAssets(first: 100) {
          nodes {
            name
            url
          }
        }
      }
    }
  }
}`

module.exports.GitHub = class GitHub {
  constructor(token) {
    this.instance = axios.create({
      baseURL: 'https://api.github.com',
      headers: {
        'Authorization': `bearer ${token}`,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5) \
        AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
      }
    })
  }

  async getRawReleases(owner, repository) {
    console.info(`getting releases for ${owner}/${repository}`)
    let rawReleaseInfos = []
    let hasNextPage = true
    let endCursor = null
    while (hasNextPage) {
      const response = await this.instance.post('/graphql', {
        query: getReleasesQuery,
        variables: {
          owner: owner,
          repository: repository,
          cursor: endCursor
        }
      })
      if(!response.data.data) {
        throw {response}
      }
      const releases = response.data.data.repository.releases
      rawReleaseInfos.push(...releases.nodes)
      hasNextPage = releases.pageInfo.hasNextPage
      endCursor = releases.pageInfo.endCursor
    }
    return rawReleaseInfos
  }

  async getReleases(owner, repository, min_version = 'v0.0.0-alpha', asset_filter = /^(win32-ia32|win32-x64|linux-ia32|linux-x64)/) {
    const rawReleases = await this.getRawReleases(owner, repository)
    return rawReleases.map(rawRelease => {
        // reformat releases and run the filter on assets
        const assets = rawRelease.releaseAssets.nodes
        const filteredAssets = assets.filter(asset => asset_filter.test(asset.name) && asset.url)
        return {
          name: rawRelease.tag.name,
          assets: filteredAssets
        }
      })
      .filter(release => {
        // only keep meaningful releases (ones with a name & a non empty assets list)
        return release.name && semver.gte(release.name, min_version) && release.assets.length > 0
      })
  }
}
