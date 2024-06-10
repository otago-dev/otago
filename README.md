<p align="center">
  <a href="https://otago.dev">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://cdn.otago.dev/logo/otago-text-darkmode.png" />
      <source media="(prefers-color-scheme: light)" srcset="https://cdn.otago.dev/logo/otago-text.png" />
      <img alt="Otago" src="https://cdn.otago.dev/logo/otago-text.png" width="300" />
    </picture>
  </a>
</p>

<p align="center">
  Push new code to your react-native and expo mobile app users without store
  submission.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/otago">
    <img alt="npm-status" src="https://img.shields.io/npm/v/otago.svg?style=flat" />
  </a>
</p>

<p>
  <a aria-label="Otago documentation" href="https://otago.dev/docs">📚 Documentation</a>
  |
  <a aria-label="Changelog" href="https://github.com/otago-dev/otago/releases">📋 Changelog</a>
</p>

- [Features](#features)
- [Overview](#overview)
- [Getting started](#getting-started)
- [How to use](#how-to-use)
  - [1. Help command](#1-help-command)
  - [2. Doctor command](#2-doctor-command)
  - [3. Deploy command](#3-deploy-command)
- [Need help? Report a bug?](#need-help-report-a-bug)

## Features

- **Instant** patches and features deployment, without re-publishing on stores.

- **Support** expo and react-native apps.

- **Integrate** in minutes and check your configuration with the `doctor` command.

- **Compliant** with App Store and Play Store.

## Overview

Otago is a custom server for expo-updates library. When the SDK is installed on your mobile application, each time a user starts the app, it will check on Otago for updates. If there is a new version, it is downloaded and installed.

<p align="center">
  <img src="https://otago.dev/images/docs/global-architecture.png" alt="Architecture" width="512"/>
</p>

- **✓ Can be updated**: Javascript code, images, fonts...
- **✗ Cannot be updated**: Native code, app config, libraries that import native code...

## Getting Started

First you will need to [create an account](https://otago.dev/login?from=github).

```shell
# 1. Follow the documentation to configure your application

# 2. Check the configuration
> OTAGO_API_KEY=[api_key] npx otago doctor --project [project_ref]

# 3. Build and publish your app...

# 4. Run your first code deployment
> OTAGO_API_KEY=[api_key] npx otago deploy --project [project_ref]
```

## How to use

- [1. Help command](#1-help-command)
- [2. Doctor command](#2-doctor-command)
- [3. Deploy command](#3-deploy-command)

### 1. Help command

```shell
> npx otago help
```

```text
Usage: otago [options] [command]

CLI to deploy your code pushes with Otago services.

Options:
  -v, --version                  output the version number
  -h, --help                     display help for command

Commands:
  doctor|check-config [options]
  deploy [options]               Deploy your code pushes with Otago services.
  help [command]                 display help for command
```

### 2. Doctor command

This command helps you check your configuration.

```shell
> npx otago doctor
```

| Option name | Parameter | Required | Description |
| --- | --- | --- | --- |
| `Api Key` | `-k, --key` (or env: `OTAGO_API_KEY`) | `true` | API key to authenticate with Otago services. |
| `Project ref` | `-p, --project` (or env: `OTAGO_PROJECT`) | `true` | Project reference you want to deploy to. |

#### Envs automatic loading

| Env var | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `production` | Environnement used to load all your `.env` files. See [override order](https://github.com/bkeepers/dotenv/blob/c6e583a/README.md#what-other-env-files-can-i-use). |
| `EAS_PROFILE` | `production` | EAS profile used to load all your `env` in `eas.json` (if file is present, lower priority). |
| `OTAGO_LOAD_ENVS` | `true` | Enable or disable env auto-loading. |

### 3. Deploy command

This command bundles your app then run the code update for all the phones with the current resolved runtime version.

Important note:

- If you install or upgrade a lib which includes some native code or configuration, you cannot push it as a code update with Otago. Instead you need to increment runtime version (this is automatic with `fingerprint` policy), then build and publish a new version of your app.

```shell
> npx otago deploy
```

| Option name | Parameter | Required | Description |
| --- | --- | --- | --- |
| `Api Key` | `-k, --key` (or env: `OTAGO_API_KEY`) | `true` | API key to authenticate with Otago services. |
| `Project ref` | `-p, --project` (or env: `OTAGO_PROJECT`) | `true` | Project reference you want to deploy to. |
| `Platforms` | `-pf, --platforms` (or env: `OTAGO_PLATFORMS`) | `false` | Platforms to deploy, comma separated. Example: `android,ios`. Default: `all`. |
| `Code signing private key` | `-pk, --private-key` (or env: `OTAGO_PRIVATE_KEY`) | `false`<br>(`true` if code signing is configured) | Private key (or its path) to sign your update. |

#### Envs automatic loading

| Env var | Default | Description |
| --- | --- | --- |
| `NODE_ENV` | `production` | Environnement used to load all your `.env` files. See [override order](https://github.com/bkeepers/dotenv/blob/c6e583a/README.md#what-other-env-files-can-i-use). |
| `EAS_PROFILE` | `production` | EAS profile used to load all your `env` in `eas.json` (if file is present, lower priority). |
| `OTAGO_LOAD_ENVS` | `true` | Enable or disable env auto-loading. |

## Need Help? Report a bug?

[Submit an issue](https://github.com/otago-dev/otago/issues) to the project Github if you need any help.
And, of course, feel free to submit pull requests with bug fixes or changes.
