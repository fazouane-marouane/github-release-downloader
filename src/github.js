"use strict";
import axios from "axios";
import semver from "semver";

const getReleasesQuery = `
query($releaseCursor: String, $assetCursor: String, $owner: String!, $repository: String!) {
  repository(owner: $owner, name: $repository) {
    releases(first: 1, after: $releaseCursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
      nodes {
        tag {
          name
        }
        releaseAssets(first: 10, after: $assetCursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            name
            url
          }
        }
      }
    }
  }
}`;

export class GitHub {
  constructor(token, proxy) {
    this.instance = axios.create({
      timeout: 60 * 1000,
      baseURL: "https://api.github.com",
      headers: {
        Authorization: `bearer ${token}`,
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_5) \
        AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36"
      },
      ...(proxy ? { proxy } : null)
    });
  }

  async *getRawReleases(owner, repository, matchVersion, min_version) {
    console.info(`getting releases for ${owner}/${repository}`);
    let releaseHasNextPage = true;
    let releaseEndCursor = null;
    while (releaseHasNextPage) {
      let assetHasNextPage = true;
      let assetEndCursor = null;
      let releases = null;
      while (assetHasNextPage) {
        const response = await this.instance.post("/graphql", {
          query: getReleasesQuery,
          variables: {
            owner: owner,
            repository: repository,
            releaseCursor: releaseEndCursor,
            assetCursor: assetEndCursor
          }
        });
        if (!response.data.data) {
          throw {
            response
          };
        }
        releases = response.data.data.repository.releases;
        const releaseInfo = releases.nodes[0]; // only one release at a time
        if (
          !releaseInfo ||
          !releaseInfo.tag.name ||
          !semver.gte(
            semver.coerce(releaseInfo.tag.name),
            semver.coerce(min_version)
          ) ||
          !matchVersion.test(releaseInfo.tag.name)
        ) {
          // ignore this release altogether
          break;
        }
        assetHasNextPage = releaseInfo.releaseAssets.pageInfo.hasNextPage;
        assetEndCursor = releaseInfo.releaseAssets.pageInfo.endCursor;
        yield {
          name: releaseInfo.tag.name,
          assets: releaseInfo.releaseAssets.nodes
        };
      }
      releaseHasNextPage = releases.pageInfo.hasNextPage;
      releaseEndCursor = releases.pageInfo.endCursor;
    }
  }

  async *getReleases(
    owner,
    repository,
    matchVersion,
    min_version,
    asset_filter
  ) {
    for await (const release of this.getRawReleases(
      owner,
      repository,
      matchVersion,
      min_version
    )) {
      // run the filter on assets
      const filteredAssets = release.assets.filter(
        asset => asset_filter.test(asset.name) && asset.url
      );
      if (filteredAssets.length > 0) {
        // only keep meaningful releases (ones with non empty assets list)
        yield {
          name: release.name,
          assets: filteredAssets
        };
      }
    }
  }
}
