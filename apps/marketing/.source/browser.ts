// @ts-nocheck
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, import("fumadocs-mdx/runtime/types").InternalTypeConfig & {
  DocData: {
  }
}>();
const browserCollections = {
  docs: create.doc("docs", {"advisory-sources.mdx": () => import("../content/docs/advisory-sources.mdx?collection=docs"), "api-reference.mdx": () => import("../content/docs/api-reference.mdx?collection=docs"), "configuration.mdx": () => import("../content/docs/configuration.mdx?collection=docs"), "dependency-graph.mdx": () => import("../content/docs/dependency-graph.mdx?collection=docs"), "findings.mdx": () => import("../content/docs/findings.mdx?collection=docs"), "github-app.mdx": () => import("../content/docs/github-app.mdx?collection=docs"), "how-it-works.mdx": () => import("../content/docs/how-it-works.mdx?collection=docs"), "index.mdx": () => import("../content/docs/index.mdx?collection=docs"), "integrations.mdx": () => import("../content/docs/integrations.mdx?collection=docs"), "policies.mdx": () => import("../content/docs/policies.mdx?collection=docs"), "quickstart.mdx": () => import("../content/docs/quickstart.mdx?collection=docs"), "risk-scoring.mdx": () => import("../content/docs/risk-scoring.mdx?collection=docs"), "scanning.mdx": () => import("../content/docs/scanning.mdx?collection=docs"), "self-hosting.mdx": () => import("../content/docs/self-hosting.mdx?collection=docs"), "supply-chain-analysis.mdx": () => import("../content/docs/supply-chain-analysis.mdx?collection=docs"), "triggers.mdx": () => import("../content/docs/triggers.mdx?collection=docs"), }),
};
export default browserCollections;