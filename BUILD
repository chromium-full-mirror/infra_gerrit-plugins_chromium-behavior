load("//tools/bzl:js.bzl", "polygerrit_plugin")
load("@npm//@bazel/rollup:index.bzl", "rollup_bundle")

rollup_bundle(
    name = "chromium-behavior-bundle",
    srcs = glob(["src/main/resources/static/*.js"]),
    entry_point = "src/main/resources/static/chromium-behavior.js",
    rollup_bin = "//tools/node_tools:rollup-bin",
    sourcemap = "hidden",
    deps = [
        "@tools_npm//rollup-plugin-node-resolve",
    ],
)

polygerrit_plugin(
    name = "chromium-behavior",
    app = "chromium-behavior-bundle.js",
)
