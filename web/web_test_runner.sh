#!/bin/bash

set -euo pipefail

./$1 --config $2 \
  --dir 'plugins/chromium-behavior/web/_bazel_ts_out_tests' \
  --test-files 'plugins/chromium-behavior/web/_bazel_ts_out_tests/*_test.js' \
  --ts-config="plugins/chromium-behavior/web/tsconfig.json"

