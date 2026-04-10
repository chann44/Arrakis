// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – .source/ is generated at build time by fumadocs-mdx
import { docs } from "../../.source/server";
import { loader } from "fumadocs-core/source";

export const source = loader({
  baseUrl: "/docs",
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  source: (docs as any).toFumadocsSource(),
});
