import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const results = [];
for (let index = 0; index < 3; index++) {
  const output = execFileSync(
    process.execPath,
    ["tests/cooldown-playtest.js"],
    {
      env: { ...process.env, COOLDOWN_AREA: String(index) },
      encoding: "utf8",
    },
  );
  const report = JSON.parse(output);
  results.push({
    area: index,
    success: report.success,
    seconds: report.elapsed,
    escapes: report.escapes,
    timeline: report.timeline.filter((event) => event.event !== "sample"),
  });
}
writeFileSync(
  "artifacts/integrated-cooldown-loop.json",
  JSON.stringify(
    { success: results.every((result) => result.success), results },
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    results.map(({ timeline, ...result }) => result),
    null,
    2,
  ),
);
