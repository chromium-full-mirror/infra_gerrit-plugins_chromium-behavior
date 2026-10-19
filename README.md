# Chrome/Chromium behavior theme for Gerrit

### Setup

This plugin must be placed inside the Gerrit plugins directory:

    git clone --recurse-submodules https://gerrit.googlesource.com/gerrit
    cd gerrit/plugins
    git clone https://chromium.googlesource.com/infra/gerrit-plugins/chromium-behavior

### Web Plugin Development

Run the commands below in web/.

For running TypeScript unit tests execute:

    make test

For checking or fixing eslint formatter problems run:

    make lint_test
    make lint_fix

For testing the plugin with
[Gerrit FE Dev Helper](https://gerrit.googlesource.com/gerrit-fe-dev-helper/):

1. Build the JavaScript bundle in `plugins/chromium-behavior/web` (this copies `chromium-behavior.js` to `plugins/chromium-behavior/chromium-behavior.js`):

       make build

2. Navigate to the root of the `gerrit` repository, expose the built plugin bundle under `polygerrit-ui/app/plugins/` (the root directory served by Gerrit's `@web/dev-server`), and start the dev server on port `8081`:

       cd ../../..
       mkdir -p polygerrit-ui/app/plugins
       ln -sf ../../../plugins/chromium-behavior/chromium-behavior.js \
         polygerrit-ui/app/plugins/chromium-behavior.js

       # First-time setup only (if node_modules are not installed):
       yarn install

       # Start the local web dev server on http://localhost:8081
       yarn start:server

3. In the Gerrit FE Dev Helper Chrome extension, enable the extension on your target Gerrit host (e.g. `chromium-review.googlesource.com` or `chromium-review.git.corp.google.com`) and add a `redirect` rule:
   - **From**: `.+/plugins/chromium-behavior/static/chromium-behavior.js`
   - **To**: `http://localhost:8081/plugins/chromium-behavior.js`

Whenever you make changes in `web/`, re-run `make build` in `plugins/chromium-behavior/web` and reload the Gerrit page.
