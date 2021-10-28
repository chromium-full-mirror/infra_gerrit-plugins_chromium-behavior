# Chrome/Chromium behavior theme for Gerrit

### Setup

This plugin must be placed inside the Gerrit plugins directory:

    git clone --recurse-submodules https://gerrit.googlesource.com/gerrit
    cd gerrit/plugins
    git clone https://chromium.googlesource.com/infra/gerrit-plugins/chromium-behavior

### Web Plugin Development

For running TypeScript unit tests execute:

    bazel test --test_output=all //plugins/chromium-behavior/web:karma_test

For checking or fixing eslint formatter problems run:

    bazel test //plugins/chromium-behavior/web:lint_test
    bazel run //plugins/chromium-behavior/web:lint_bin -- \
      --fix "$(pwd)/plugins/chromium-behavior/web"

For testing the plugin with
[Gerrit FE Dev Helper](https://gerrit.googlesource.com/gerrit-fe-dev-helper/)
build the JavaScript bundle and copy it to the `plugins/chromium-behavior` folder:

    bazel build //plugins/chromium-behavior/web:chromium-behavior
    cp -f bazel-bin/plugins/chromium-behavior/web/chromium-behavior.js plugins/

Start polygerit-ui server:

    ./polygerrit-ui/run-server.sh --plugins="plugins"

and let the Dev Helper redirect from
`.+/plugins/chromium-behavior/static/chromium-behavior.js` to
`http://localhost:8081/plugins/chromium-behavior.js`.
