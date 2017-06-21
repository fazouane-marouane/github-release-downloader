# github-release-downloader
[![npm version](https://badge.fury.io/js/github-release-downloader.svg)](https://badge.fury.io/js/github-release-downloader)
[![Build status](https://ci.appveyor.com/api/projects/status/4fdxoq06aq002end/branch/master?svg=true)](https://ci.appveyor.com/project/practicaljs/github-release-downloader/branch/master)
[![CircleCI](https://circleci.com/gh/practicaljs/github-release-downloader/tree/master.svg?style=svg)](https://circleci.com/gh/practicaljs/github-release-downloader/tree/master)
[![license](https://img.shields.io/github/license/practicaljs/github-release-downloader.svg)](https://github.com/practicaljs/github-release-downloader/blob/master/LICENSE)

# Installation

Installing the cli tool is as easy as this:

```bash
npm install -g github-release-downloader
```

# Simple usage

For example, to download all node-sass's binaries:

```bash
grd --token <your github api token> --owner sass --repository node-sass
```

To download all node-sass's binaries for versions above v4.0.0 you would do

```bash
grd --token <your github api token> --owner sass --repository node-sass --min-version v4.0.0
```

# Advanced usages

## 1. Custom download path

By default the download path is the path from where you ran `node`. But it's easy to override this with the the option `--output` (or `-o` if you feel that life is too short).

## 2. Parallel download

By default downloads are launched in parrallel; 3 downloads at a time.
You can ofcourse specify a more appropriate number if you like:

```bash
grd --token <your github api token> --owner sass --repository node-sass --parallel 10
```
