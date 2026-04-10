import { DocsLayout } from "fumadocs-ui/layouts/docs";
import type { ReactNode } from "react";
import { source } from "@/lib/source";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DocsLayout
      tree={source.pageTree}
      nav={{
        title: (
          <span
            style={{
              fontFamily: "'DotGothic16', monospace",
              fontSize: "1rem",
              letterSpacing: "0.15em",
              color: "#FAD9D3",
            }}
          >
            ARRAKIS
          </span>
        ),
      }}
      sidebar={{
        banner: (
          <div
            style={{
              padding: "0.625rem 0.875rem",
              borderRadius: "4px",
              background: "rgba(250,217,211,0.05)",
              border: "1px solid rgba(250,217,211,0.12)",
              marginBottom: "0.5rem",
            }}
          >
            <p
              style={{
                fontFamily: "'DotGothic16', monospace",
                fontSize: "0.6rem",
                letterSpacing: "0.1em",
                color: "#959190",
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              SYS.ONLINE // DOCS v0.1
            </p>
          </div>
        ),
      }}
    >
      {children}
    </DocsLayout>
  );
}
