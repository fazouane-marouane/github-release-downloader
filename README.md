# github-release-downloader

# Installation

Installing the cli tool is as easy as this:

```bash
npm install -g github-release-downloader
```

# Usage

For example, to download all node-sass's binaries:

```bash
grd --token <your github api token> --owner sass --repository node-sass
```

To download all node-sass's binaries for versions above v4.0.0 you would do

```bash
grd --token <your github api token> --owner sass --repository node-sass --min-version v4.0.0
```
