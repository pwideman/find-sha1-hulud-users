# find-sha1-hulud-users

A custom GitHub action to find Enterprise Organization members and outside collaborators with potential Sha1-Hulud activity.

## Overview

This action helps identify GitHub Enterprise users that may have been compromised by the Sha1-Hulud worm. It performs the following steps:

1. **Enumerate Organizations**: Fetches all organizations in the specified GitHub Enterprise
2. **Search for Infected Repositories**: Searches GitHub for public repositories containing the Sha1-Hulud signature ("Sha1-Hulud: The Second Coming")
3. **Check User Memberships**: For each repository owner found, checks if they are a member or outside collaborator of any enterprise organization (with concurrent API requests and caching)
4. **Generate Reports**: Produces a workflow summary with statistics and a detailed table, plus a CSV file for further analysis

## Usage

```yaml
- name: Find Sha1-Hulud Users
  uses: pwideman/find-sha1-hulud-users@v1
  with:
    github-token: ${{ secrets.ENTERPRISE_TOKEN }}
    enterprise: 'your-enterprise-slug'
    output-dir: 'reports'
```

## Inputs

| Input          | Description                                                                                            | Required | Default |
| -------------- | ------------------------------------------------------------------------------------------------------ | -------- | ------- |
| `github-token` | GitHub token with `admin:org` read permissions to access enterprise organizations and check membership | Yes      |         |
| `enterprise`   | The slug of the GitHub Enterprise to scan for potentially compromised users                            | Yes      |         |
| `output-dir`   | Directory to write the CSV output file (`sha1-hulud-users.csv`). Can be a full or relative path.       | No       | `.`     |

### Token Permissions

The GitHub token needs the following permissions:

- `read:org` - To list organizations in the enterprise
- `read:enterprise` - To enumerate enterprise organizations
- Organization membership read access for all organizations in the enterprise

## Outputs

| Output        | Description                                                                           |
| ------------- | ------------------------------------------------------------------------------------- |
| `users-found` | Number of unique users with Sha1-Hulud repositories found in enterprise organizations |
| `repos-found` | Number of Sha1-Hulud repositories found                                               |

## CSV Output

The action produces a CSV file named `sha1-hulud-users.csv` in the directory specified by the `output-dir` input containing:

- Username
- Profile URL
- Repository Count
- Repository URLs
- Whether the user has enterprise membership
- List of organization memberships and their type (member or outside collaborator)

The directory will be created if it does not exist.

## Example Workflow

```yaml
name: Scan for Sha1-Hulud Users

on:
  schedule:
    - cron: '0 0 * * *' # Run daily
  workflow_dispatch: # Allow manual trigger

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Find Sha1-Hulud Users
        uses: pwideman/find-sha1-hulud-users@v1
        with:
          github-token: ${{ secrets.ENTERPRISE_TOKEN }}
          enterprise: 'your-enterprise-slug'
          output-dir: 'reports'

      - name: Upload CSV Report
        uses: actions/upload-artifact@v4
        with:
          name: sha1-hulud-users
          path: reports/sha1-hulud-users.csv
```

## Development

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
npm install
```

### Build

```bash
npm run bundle
```

### Test

```bash
npm run test
```

### Lint and Format

```bash
npm run lint
npm run format
```

### Run all checks

```bash
npm run all
```

## License

MIT
