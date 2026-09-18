import jsonPlugin from "@rollup/plugin-json";
import { readFileSync } from "fs";
import { join } from "path";

const branchRegexp = /ref: .*\/(\w*)/;
const shortRegexp = /0000000000000000000000000000000000000000 ([0-9a-f]{8})/;
const dirRegexp = /(.*)[\/\\]?package.json/;

export default function version(options) {
	const jsonTransformer = jsonPlugin(options).transform;

	return {
		name: "git-version",

		transform: function transform(json, id) {
			if (id.indexOf("node_modules") === -1 && id.match(/package\.json$/)) {
				const dir = dirRegexp.exec(id)[1];
				let parsed = JSON.parse(json);

				try {
					// Read some files in the ".git" subdirectory
					// The technique should be OS-agnostic enough
					const data1 = readFileSync(join(dir, ".git/HEAD"));
					const branch = branchRegexp.exec(data1)[1];

					const data2 = readFileSync(join(dir, ".git/logs/HEAD"));
					const short = shortRegexp.exec(data2)[1];

					parsed.version += "+" + branch + "." + short;
				} catch (ex) {
					// An exception might happen when the git info was not found
					// (i.e. no ".git" subdirectory, weird filesystem or git install)
					// or if the format of the files is unrecognized.
					// The fallback is to return the package.json file unmodified

					console.warn(
						`git-version plugin couldn't parse git information from ${dir}`
					);
				}

				return jsonTransformer(JSON.stringify(parsed), id);
			} else {
				return null;
			}
		},
	};
}
