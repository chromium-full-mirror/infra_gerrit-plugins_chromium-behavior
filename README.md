# Chrome/Chromium behavior theme for Gerrit

## To run unit tests

```
$ npm run wct-test
```

## To test with Gerrit FE Dev Helper
Make sure the plugin is installed in plugins/ of Gerrit repository.

```
$ cd ../.. # Gerrit root directory
$ bazel build plugins/chromium-behavior:chromium-behavior
$ cp -f bazel-bin/plugins/chromium-behavior/chromium-behavior-bundle.js plugins/
$ cd plugins/chromium-behavior
$ run-with-prod-data.sh
```
