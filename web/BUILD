load("@aspect_rules_ts//ts:defs.bzl", "ts_config", "ts_project")
load("//tools/js:eslint.bzl", "plugin_eslint")
load("//tools/bzl:js.bzl", "gerrit_js_bundle", "web_test_runner")

package_group(
    name = "visibility",
    packages = ["//plugins/chromium-behavior/..."],
)

package(default_visibility = [":visibility"])

ts_config(
    name = "tsconfig",
    src = "tsconfig.json",
    deps = [
        "//plugins:tsconfig-plugins-base",
    ],
)

ts_project(
    name = "chromium-behavior-ts",
    srcs = glob(
        ["**/*.ts"],
        exclude = ["**/*test*"],
    ),
    incremental = True,
    out_dir = "_bazel_ts_out",
    tsconfig = ":tsconfig",
    deps = [
        "//plugins:node_modules",
    ],
)

ts_project(
    name = "chromium-behavior-ts-tests",
    srcs = glob(["**/*.ts"]),
    incremental = True,
    out_dir = "_bazel_ts_out_tests",
    tsconfig = ":tsconfig",
    deps = [
        "//plugins:node_modules",
        "//polygerrit-ui:node_modules",
    ],
)

gerrit_js_bundle(
    name = "chromium-behavior",
    srcs = [":chromium-behavior-ts"],
    entry_point = "_bazel_ts_out/plugin.js",
)

web_test_runner(
    name = "web_test_runner",
    srcs = ["web_test_runner.sh"],
    data = [
        ":chromium-behavior-ts-tests",
        ":tsconfig",
        "//plugins:node_modules",
        "//polygerrit-ui:node_modules",
    ],
)

plugin_eslint()
