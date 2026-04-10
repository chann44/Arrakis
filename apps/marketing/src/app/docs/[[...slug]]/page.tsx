import { source } from "@/lib/source";
import { getMDXComponents } from "@/components/mdx";
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from "fumadocs-ui/page";
import { notFound } from "next/navigation";

// .source/server is generated at build time; types are loose
type AnyData = Record<string, unknown> & {
  title?: string;
  description?: string;
  toc?: unknown;
  full?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body?: any;
};

export default async function Page({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const data = page.data as AnyData;
  const MDX = data.body;

  return (
    <DocsPage
      toc={(data.toc ?? []) as React.ComponentProps<typeof DocsPage>["toc"]}
      full={data.full ?? false}
      tableOfContent={{
        style: "clerk",
        single: false,
      }}
    >
      <DocsTitle>{data.title}</DocsTitle>
      <DocsDescription>{data.description}</DocsDescription>
      <DocsBody>
        {MDX && <MDX components={getMDXComponents()} />}
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();
  const data = page.data as AnyData;
  return {
    title: `${data.title ?? "Docs"} — Arrakis`,
    description: data.description,
  };
}

// Required for React namespace
import React from "react";
