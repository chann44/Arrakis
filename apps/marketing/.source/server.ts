// @ts-nocheck
import * as __fd_glob_16 from "../content/docs/triggers.mdx?collection=docs"
import * as __fd_glob_15 from "../content/docs/supply-chain-analysis.mdx?collection=docs"
import * as __fd_glob_14 from "../content/docs/self-hosting.mdx?collection=docs"
import * as __fd_glob_13 from "../content/docs/scanning.mdx?collection=docs"
import * as __fd_glob_12 from "../content/docs/risk-scoring.mdx?collection=docs"
import * as __fd_glob_11 from "../content/docs/quickstart.mdx?collection=docs"
import * as __fd_glob_10 from "../content/docs/policies.mdx?collection=docs"
import * as __fd_glob_9 from "../content/docs/integrations.mdx?collection=docs"
import * as __fd_glob_8 from "../content/docs/index.mdx?collection=docs"
import * as __fd_glob_7 from "../content/docs/how-it-works.mdx?collection=docs"
import * as __fd_glob_6 from "../content/docs/github-app.mdx?collection=docs"
import * as __fd_glob_5 from "../content/docs/findings.mdx?collection=docs"
import * as __fd_glob_4 from "../content/docs/dependency-graph.mdx?collection=docs"
import * as __fd_glob_3 from "../content/docs/configuration.mdx?collection=docs"
import * as __fd_glob_2 from "../content/docs/api-reference.mdx?collection=docs"
import * as __fd_glob_1 from "../content/docs/advisory-sources.mdx?collection=docs"
import { default as __fd_glob_0 } from "../content/docs/meta.json?collection=docs"
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>({"doc":{"passthroughs":["extractedReferences"]}});

export const docs = await create.docs("docs", "content/docs", {"meta.json": __fd_glob_0, }, {"advisory-sources.mdx": __fd_glob_1, "api-reference.mdx": __fd_glob_2, "configuration.mdx": __fd_glob_3, "dependency-graph.mdx": __fd_glob_4, "findings.mdx": __fd_glob_5, "github-app.mdx": __fd_glob_6, "how-it-works.mdx": __fd_glob_7, "index.mdx": __fd_glob_8, "integrations.mdx": __fd_glob_9, "policies.mdx": __fd_glob_10, "quickstart.mdx": __fd_glob_11, "risk-scoring.mdx": __fd_glob_12, "scanning.mdx": __fd_glob_13, "self-hosting.mdx": __fd_glob_14, "supply-chain-analysis.mdx": __fd_glob_15, "triggers.mdx": __fd_glob_16, });