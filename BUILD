load("//tools/bzl:plugin.bzl", "gerrit_plugin")

genrule(
  name = "chromium-behavior",
  srcs = ["src/main/resources/static/chromium-behavior.html"],
  outs = ["chromium-behavior.html"],
  cmd = "cp $< $@",
)
