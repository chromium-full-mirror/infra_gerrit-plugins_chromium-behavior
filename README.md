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
[Gerrit FE Dev Helper](https://gerrit.googlesource.com/gerrit-fe-dev-helper/)
the command below builds the JavaScript bundle and copies it to the `plugins/chromium-behavior` folder:

    make build

Start polygerit-ui server:

    ./polygerrit-ui/run-server.sh --plugins="plugins"

and let the Dev Helper redirect from
`.+/plugins/chromium-behavior/static/chromium-behavior.js` to
`http://localhost:8081/plugins/chromium-behavior.js`.
